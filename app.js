const express = require('express');
const path = require('path');
const chalk = require('chalk');
const bodyParser = require('body-parser');
const passport = require('passport');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const mongoose = require("mongoose");
const multer = require('multer');
const { MongoClient, ObjectID } = require('mongodb');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;
let uri = 'mongodb://localhost:27017';
mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
mongoose.set('useFindAndModify', false);

app.use(express.static(path.join(__dirname, '/public/')));
app.use('/css', express.static(path.join(__dirname, '/node_modules/bootstrap/dist/css')));
app.use('/js', express.static(path.join(__dirname, '/node_modules/bootstrap/dist/js')));
app.use('/js', express.static(path.join(__dirname, '/node_modules/jquery/dist')));
app.set('views', './src/views');
app.set('view engine', 'pug');

const Folder = mongoose.model('Folder', {
  name: String,
  folder_img: String
});

const Image = mongoose.model('Image', {
  folder_category: String,
  image: String
});

// SET STORAGE
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
      cb(null, 'public/img/photos')
  },
  filename: function (req, file, cb) {
      cb(null, file.fieldname + '-' + Date.now() + '-' + file.originalname)
  }
})
const upload = multer({ storage: storage });

app.get('/', async (req, res) => {
  //internal scope of this function
  const documents = await Folder.find().exec();
  const indexVariables = {
      pageTitle: "First page of our app",
      folders: documents
  }
  const img_documents = await Image.find().exec();
  res.render('index', { variables: indexVariables, photos: img_documents});
});

app.get('/newFolder', (req, res) => {
  res.render('newFolder');
})

app.get('/newPhoto', (req, res) => {
  var folder_categoryList = []
  
  Folder.find({} , function (err, document) {
    document.forEach(document => { 
      folder_categoryList.push(document.name);
    }); 
    res.render('newPhoto', { folder_categoryList: folder_categoryList});
    });
});


app.get('/folders/:id', async (req, res) => {
  const selectedId = req.params.id;
  Folder.findById(selectedId, function (err, document) {
    Image.find({"folder_category": document.name}, function (err, img_documents) {
      res.render('image', { folder: document, photos: img_documents})
    });
  });
});


//Update View
app.get('/update/:id', async (req, res) => {
  try {
      const selectedId = req.params.id;
      const document = await Folder.findById(selectedId).exec();
      res.render('update', { folder: document });
  } catch (err) {
      console.log("ERR: ", err)
  }
});

//delete endpoint
app.get('/delete/:id', async (req, res) => {
  //internal scope of this function
  const idToDelete = req.params.id;
  const document = await Folder.findById(idToDelete).exec();
  //Delete the image from folder
  deleteImage(document.folder_img);
  
  //Delete object from database
  await Folder.deleteOne({ _id: idToDelete }).exec();
  res.redirect('/');
});


app.post('/folders', upload.single('file'), (req, res) => {
  //internal scope of this function
  const newFolder = {
      name: req.body.folder.toUpperCase(),
      folder_img: req.file.filename
  }
  const folder = new Folder(newFolder);
  folder.save()
  res.redirect('/');
});

app.post('/photos', upload.single('file'), (req, res) => {
  //internal scope of this function
  const newPhoto = {
      folder_category: req.body.category.toUpperCase(),
      image: req.file.filename
  }
  const photo = new Image(newPhoto);
  photo.save()
  res.redirect('/');
});

app.post('/folderUpdate/:id', upload.single('file'), async (req, res) => {
  try {
      const idToUpdate = req.params.id;

      //create the updateObject
      let updateObject = {
          "name": req.body.folder.toUpperCase(),
      }

      let updateFolderCategory = {
        "folder_category": req.body.folder.toUpperCase(),
      }
      //logic to handle the image
      if (req.file) {
          console.log("Updating image");
          updateObject.folder_img = req.file.filename;
      }
      //call update on database
      let filter = { _id: idToUpdate };

      //find the document and put in memory
      const document = await Folder.findById(idToUpdate).exec();
      
      // Update the folder_category name of the photos(Image Model) in the particular folder
      Folder.findById(idToUpdate, function (err, document) {
        Image.find({"folder_category": document.name}, function (err, category) {       
          Image.update({"folder_category": document.name}, updateFolderCategory, { multi: true },function (err, category) {          
          }) 
        })
      });
      // Then update the folder
      let result = await Folder.updateOne(filter, updateObject).exec();

      if (result.ok > 0 && req.file) {
          // delete the image 
          deleteImage(document.folder_img);
      }
      
  } catch (err) {
      console.log("ERR: ", err);
  } finally {
      //redirect user to index
      res.redirect('/');
  }
});

function deleteImage(image){
  const dir = __dirname + "/public/img/photos/" + image;
  if (fs.existsSync(dir)) {
      fs.unlink(dir, (err) => {
          if (err) throw err;
          console.log('successfully deleted images from folder photos');
      });
  }
}

app.listen(port, () => {
  console.log(`listening at port ${chalk.green(port)}`);
  });
  