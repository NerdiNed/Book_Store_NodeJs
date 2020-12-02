const passwordHash = require('password-hash')
// const {MongoClient, ObjectID} = require('mongodb')
const mySql = require('mysql')
const fs = require('fs')
const { resolve } = require('path')

// declare con
let con = null

// connection function
function connect() {
    return new Promise((resolve, reject) => {
        if (con) {
            if (con.state === 'disconnected') {
                con.connect(error => {
                    if (error) {
                        reject(error)
                    } else {
                        resolve()
                    }
                })
            } else {
                resolve()
            }
        } else {
            con = mySql.createConnection({
                multipleStatements: true,
                host: 'name of the host',
                port: 'port number',
                user: 'user name',
                password: 'password',
                database: 'database name'
            })
            con.connect(error => {
                if (error) {
                    reject(error)
                } else {
                    resolve()
                }
            })
        }
    })
}

// query string function to replace connection function and insert query's to the database
function runQuery(queryString) {
    return new Promise((resolve, reject) => {
        connect().then(() => {
            con.query(queryString, (error, result, fields) => {
                if (error) {
                    reject(error)
                } else {
                    resolve(result)
                }
            })
        }).catch(error => {
            reject(error)
        })
    })
}

// register non existing user to database
function registerUser(email, password) {
    return new Promise((resolve, reject) => {
        // "INSERT INTO users (email, password) VALUES ('" + email + "', '" + passwordHash.generate(password) + "')"
        runQuery(`INSERT INTO users (email, password) VALUES ('${email}', '${passwordHash.generate(password)}')`).then(() => {
            resolve()
        }).catch(error => {
            if (error.errno === 1062) {
                reject('exist')
            } else {
                reject(error)
            }
        })
    })
}

  // check for existing user in database
function checkUser(email, password) {
    return new Promise((resolve, reject) => {
        // any result from SELECT query will be return as an array (empty array or array with one element or array with many elements)
        runQuery(`SELECT * FROM users where email like '${email}'`).then(result => {
            console.log(result)
            if (result.length === 0) {
                reject(3)
            } else {
                if (passwordHash.verify(password, result[0].password)) {
                    result[0]._id = result[0].id
                    resolve(result[0])
                } else {
                    reject(3)
                }
            }
        }).catch(error => {
            reject(error)
        })
    })
}

// add a book to the database 
// make title and user id on books table unique together
// ALTER TABLE books ADD UNIQUE `book_title`(userid, title);
// make imgUrl and book id in imgs table unique together
// ALTER TABLE imgs ADD UNIQUE `img_url`(bookid, imgUrl);
function addBook(bookTitle, bookDescription, bookPdf, bookImgs, userid) {
    return new Promise((resolve, reject) => {
        // set a new pdf file name
        let pdfName = bookTitle.trim().replace(/ /g, '_') + '_' + userid + '.pdf'
        // move the pdf file with the new name to uploadedfiles folder
        bookPdf.mv('./public/uploadedfiles/' + pdfName)
        // set the pdf url that gonna be saved in the json file
        let pdfNewUrl = '/uploadedfiles/' + pdfName
        runQuery(`INSERT INTO books (title, description, pdfUrl, userid) VALUES 
        ('${bookTitle}', '${bookDescription}', '${pdfNewUrl}', ${userid})`).then(result => {
            let saveImgsQuery = ''
            bookImgs.forEach((img, idx) => {
                // get file extension
                let ext = img.name.substr(img.name.lastIndexOf('.'))
                // set the new image name
                let newName = bookTitle.trim().replace(/ /g, '_') + '_' + userid + '_' + idx + ext
                img.mv('./public/uploadedfiles/' + newName)
                const imgUrl = '/uploadedfiles/' + newName
                saveImgsQuery += `INSERT INTO imgs (imgUrl, bookid) VALUES ('${imgUrl}', ${result.insertId});`
                //imgsArr.push('/uploadedfiles/' + newName)
            });
            runQuery(saveImgsQuery).then(() => {
                resolve()
            }).catch(error => {
                reject(error)
            })
        }).catch(error => {
            if (error.errno === 1062) {
                reject(3)
            } else {
                reject(error)
            }
        })
    })
}


// get all books from database to the front to be able to view
function getAllBooks() {
    return new Promise((resolve, reject) => {
        runQuery('SELECT books.*, imgs.* FROM books INNER JOIN imgs on books.id = imgs.bookid').then(results => {
            const books = []
            results.forEach(result => {
                // search if the book has been added to books array
                let book = books.find(element => element.id === result.bookid)
                if (book){
                    // if the book is added before, we need  only to append the imgs property with the new imgurl
                    book.imgs.push(result.imgUrl)
                } else {
                    // if the book is not added to books, 
                    // we need to add it to books and set imgs as new array with one element imgurl
                    books.push({
                        id: result.bookid,
                        title: result.title,
                        description: result.description,
                        pdfUrl: result.pdfUrl,
                        userid: result.userid,
                        imgs: [result.imgUrl]
                    })
                }
            })
            resolve(books)
        }).catch(error => {
            reject(error)
        })
    })
}

// access a single book from the database 
function getBook(id) {
    return new Promise((resolve, reject) => {
        runQuery(`SELECT books.* , imgs.* FROM books INNER JOIN imgs ON imgs.bookid = books.id wHERE imgs.bookid = ${id}`).then(results => {
            if (results.length) {
                const book = {}
                results.forEach(result => {
                    if(book.id) {
                        book.imgs.push(result.imgUrl)
                    } else {
                        book.id = result.bookid
                        book.title = result.title
                        book.description = result.description
                        book.pdfUrl = result.pdfUrl
                        book.userid = result.userid
                        book.imgs = [result.imgUrl]
                    }
                })
                resolve(book)
            } else {
                reject(new Error('can not find a book with this id : ' + id))
            }
        }).catch(error => {
            reject(error)
        })
    })
}

// get a user specific book
function userBooks(userid) {
    return new Promise((resolve, reject) => {
        runQuery(`SELECT books.*, imgs.* FROM books INNER JOIN imgs on books.id = imgs.bookid WHERE books.userid = ${userid}`).then(results => {
            const books = []
            results.forEach(result => {
                // search if the book has been added to books array
                let book = books.find(element => element.id === result.bookid)
                if (book){
                    // if the book is added before, we need  only to append the imgs property with the new imgurl
                    book.imgs.push(result.imgUrl)
                } else {
                    // if the book is not added to books, 
                    // we need to add it to books and set imgs as new array with one element imgurl
                    books.push({
                        id: result.bookid,
                        title: result.title,
                        description: result.description,
                        pdfUrl: result.pdfUrl,
                        userid: result.userid,
                        imgs: [result.imgUrl]
                    })
                }
            })
            resolve(books)
        }).catch(error => {
            reject(error)
        })
    })
}

// edit an existing book 
function updateBook(bookid, newBookTitle, oldImgsUrls, bookDescription, newPdfBook, newImgs, userid) {
    return new Promise((resolve, reject) => {
        try {
            (async () => {
                let oldBookData = await getBook(bookid)
                const deletedImgs = []
                const keepImgs = []
                // get update version number
                // let updateNum = 1
                // if(oldBookData.update){
                //     updateNum = oldBookData.update +1
                // }

                // check which images user wants to keep and which to delete
                oldBookData.imgs.forEach(img => {
                    if (oldImgsUrls.indexOf(img) >= 0) {
                        keepImgs.push(img)
                    } else {
                        deletedImgs.push(img)
                    }
                })
                // save new images to file system and to array to be saved to db
                let newImgsQuery = ''
                const currentTime = Date.now()
                newImgs.forEach((img, idx) => {
                    const imgExt = img.name.substr(img.name.lastIndexOf('.'))
                    const newImgName = newBookTitle.trim().replace(/ /g, '_') + '_' + userid + '_' + idx + '_' + currentTime + imgExt
                    //newImgsUrlsArr.push('/uploadedfiles/' + newImgName)
                    const newImgUrl = '/uploadedfiles/' + newImgName
                    newImgsQuery += `INSERT INTO imgs (imgUrl, bookid) VALUES ('${newImgUrl}', ${bookid} );`
                    img.mv('./public/uploadedfiles/' + newImgName)
                })
                // delete the deleted images files from the system
                let deleteImgQuery = ''
                deletedImgs.forEach(file => {
                    // first check file is exist
                    deleteImgQuery += `DELETE FROM imgs WHERE imgUrl like '${file}' AND bookid = ${bookid};`
                    if (fs.existsSync('./public' + file)) {
                        fs.unlinkSync('./public' + file)
                    }
                })
                // check if user upload a new pdf file and move it to the same place of the old one so it will OVERWRITE it
                if (newPdfBook) {
                    newPdfBook.mv('./public' + oldBookData.pdfUrl)
                }
                await runQuery(`UPDATE books SET title = '${newBookTitle}', description = '${bookDescription}' WHERE id = ${bookid};` 
                + deleteImgQuery + newImgsQuery)

                resolve()
       
            })()
        } catch (error) {
            reject(error)
        }
    })
}

 // delete a book from the database
function deleteBook(bookid, userid) {
    return new Promise((resolve, reject) => {
        getBook(bookid).then(book => {
            // check if the book belong to the current login user
            if (book.userid === userid) {
                // delete book images
                book.imgs.forEach(img => {
                    //check the img file is exist then delete it
                    if (fs.existsSync('./public' + img)) {
                        fs.unlinkSync('./public' + img)
                    }
                })
                // delete pdf file
                // check if pdf file is exist then delete it
                if (fs.existsSync('./public' + book.pdfUrl)) {
                    fs.unlinkSync('./public' + book.pdfUrl)
                }
                // connect().then(client => {
                // const db = client.db('test1')
                Books.deleteOne({
                    _id: bookid
                }).then(() => {
                    // client.close()
                    resolve()
                }).catch(error => {
                    // client.close()
                    reject(error)
                })
                // }).catch(error => {
                //     reject(error)
                // })
            } else {
                reject(new Error('hacking try. not this time'))
            }
        }).catch(error => {
            reject(error)
        })
    })

}
// export the functions
module.exports = {
    registerUser,
    checkUser,
    addBook,
    getAllBooks,
    getBook,
    userBooks,
    updateBook,
    deleteBook
}