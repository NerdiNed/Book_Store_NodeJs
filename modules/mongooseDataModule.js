const passwordHash = require('password-hash')
// const {MongoClient, ObjectID} = require('mongodb')
const mongoose = require('mongoose')
const fs = require('fs')
const connectionString = 'database connection string here'


// get Schema object
const Schema = mongoose.Schema
// creat new users schema
const usersSchema = new Schema({
    email:{
        type: String,
        unique: true,
        required: true
    },
    password: {
        type: String,
        required: true
    }
})
// creat Books schema
const bookSchema = new Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String
    },
    pdfUrl: {
        type: String,
        required: true
    },
    imgs: {
        type: [String],
        required: true,
        min: 1
    },
    userid: {
        type: String,
        required: true
    }
})

// creat Users model
const Users = mongoose.model('users', usersSchema)
// creat Books model
const Books = mongoose.model('books', bookSchema)


// connection function 
function connect() {
    return new Promise((resolve, reject) => {
        if (mongoose.connection.readyState === 1) {
            resolve()
        } else {
            mongoose.connect(connectionString, {
                useUnifiedTopology: true,
                useCreateIndex: true,
                useNewUrlParser: true
            }).then(() => {
                resolve()
            }).catch(error => {
                reject(error)
            })
        }
    })
  }

// register non existing user to database
  function registerUser (email, password) {
      return new Promise((resolve, reject) => {
          connect().then(() => {
              // creat new user
              const newUser = new Users({
                  email: email,
                  password: passwordHash.generate(password)
              })
              // save the newUser in the database
              newUser.save().then(result => {
                  console.log(result);
                  resolve()
              }).catch(error => {
                  console.log(error.code);
                  if (error.code === 11000) {
                      reject ('exist')
                  } else {
                    reject(error)
                  }
              })
          }).catch(error => {
              reject(error)
          })
      })
  }
  // check for existing user in database
  function checkUser(email, password) {
      return new Promise((resolve, reject) => {
          connect().then(() => {
              Users.findOne({email: email}).then(user => {
                 if (user) {
                     if (passwordHash.verify(password, user.password)) {
                         resolve(user)
                     } else {
                         reject(3)
                     }
                 } else {
                     reject(3)
                 }
              })
          }).catch(error => {
              reject(error)
          })
      })
  }

    // add a book to the database 
  function addBook(bookTitle, bookDescription, bookPdf, bookImgs, userid) {
      return new Promise((resolve, reject) => {
          connect().then(() => {
            // delete const db = client.db('test1')
            Books.findOne({title: bookTitle, userid: userid}).then(findBook => {
                  if(findBook) {
                    // delete client.close()
                    reject(3)
                  } else {
                      // create images array to be saved in database
                      const imgsArr = []
                      bookImgs.forEach((img, idx) => {
                          // get file extension
                            let ext = img.name.substr(img.name.lastIndexOf('.'))
                            // set the new image name
                            let newName = bookTitle.trim().replace(/ /g, '_') + '_' + userid + '_' + idx + ext
                            img.mv('./public/uploadedfiles/' + newName)
                            imgsArr.push('/uploadedfiles/' + newName)
                      });
                      // set a new pdf file name
                        let pdfName = bookTitle.trim().replace(/ /g, '_') + '_' + userid + '.pdf'
                    // move the pdf file with the new name to uploadedfiles folder
                        bookPdf.mv('./public/uploadedfiles/' + pdfName)
                    // set the pdf url that gonna be saved in the json file
                        let pdfNewUrl = '/uploadedfiles/' + pdfName
                        const newBook = new Books({
                            title: bookTitle,
                            description: bookDescription,
                            pdfUrl: pdfNewUrl,
                            imgs: imgsArr,
                            userid: userid
                        })
                        newBook.save().then(() => {
                            // delete client.close()
                            resolve()
                        }).catch(error => {
                            reject(error)
                        })
                  }
              }).catch(error => {
                // delete client.close()
                reject(error)
              })
          }).catch(error => {
              reject(error)
          })
      })
  }

// get all books from database to the front to be able to view
  function getAllBooks() {
      return new Promise((resolve, reject) => {
          connect().then(() => {
              // delete const db = client.db('test1')
              Books.find().then(books => {
                  // add id property to each book instead of _id
                  // becausethis how it used in ejs
                  books.forEach(book => {
                      // book.id = book._id
                      book['id'] = book['_id']
                  })
                  // delete client.close()
                  resolve(books)
              }).catch(error => {
                // delete client.close()
                  reject(error)
              })
          }).catch(error => {
              reject(error)
          })
      })
}
// access a single book from the database 
function getBook(id) {
   return  new Promise((resolve, reject) => {
        connect().then(() => {
            // delete const db = client.db('test1')
            Books.findOne({_id: id}).then(book => {
                // delete client.close()
                if(book) {
                    book.id = book._id
                    resolve(book)
                } else {
                    reject(new Error('can not find a book with this id : ' + id))
                }
            }).catch(error => {
                //delete client.close()
                reject(error)
            })
        }).catch(error => {
            reject(error)
        })
    })
}

// get a user specific book
function userBooks(userid) {
    return new Promise((resolve, reject) => {
        connect().then(() => {
            // delete const db = client.db('test1')
            Books.find({userid: userid}).then(books => {
                // add id property to each book instead of _id
                // becausethis how it used in ejs
                books.forEach(book => {
                    // book.id = book._id
                    book['id'] = book['_id']
                })
                // delete client.close()
                resolve(books)
            }).catch(error => {
              // delete client.close()
                reject(error)
            })
        }).catch(error => {
            reject(error)
        })
    })
  }

// edit an existing book 
function updateBook(bookid, newBookTitle, oldImgsUrls, bookDescription, newPdfBook, newImgs, userid ) {
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
                } else{
                    deletedImgs.push(img)
                }
            })
            // save new images to file system and to array to be saved to db
            const newImgsUrlsArr = []
            newImgs.forEach((img,idx) => {
                const imgExt =img.name.substr(img.name.lastIndexOf('.')) 
                const newImgName =  newBookTitle.trim().replace(/ /g, '_') + '_' + userid + '_' + idx + '_' + (oldBookData.__v + 1) + imgExt
                newImgsUrlsArr.push('/uploadedfiles/' + newImgName )
                img.mv('./public/uploadedfiles/' + newImgName)
            })
            // delete the deleted images files from the system
            deletedImgs.forEach(file => {
                // first check file is exist
                if (fs.existsSync('./public' + file)) {
                    fs.unlinkSync('./public' + file)
                }
            })
            // check if user upload a new pdf file and move it to the same place of the old one so it will OVERWRITE it
            if (newPdfBook) {
                newPdfBook.mv('./public' + oldBookData.pdfUrl)
            }
            // await connect()
            // delete const db = client.db('test1')
            await Books.updateOne({_id: bookid}, {
                
                    title: newBookTitle,
                    description: bookDescription,
                    imgs :[...keepImgs, ...newImgsUrlsArr],
                    //delete update: updateNum,
                    $inc: {__v: 1}
                
            })
            // delete client.close()
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
                    if (fs.existsSync('./public' + img)){
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
                    Books.deleteOne({_id: bookid}).then(() => {
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