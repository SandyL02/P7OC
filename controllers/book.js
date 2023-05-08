const Book = require("../models/Book");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const sharp = require("sharp");
const { v4: uuidv4 } = require("uuid");

exports.createBook = async (req, res, next) => {
  try {
    // On récupère l'objet book envoyé dans la requête sous forme de chaîne de caractères
    const bookObject = JSON.parse(req.body.book);
    // On supprime les champs _id et _userId de l'objet book, pour éviter toute modification non autorisée
    delete bookObject._id;
    delete bookObject._userId;
    // On crée une nouvelle instance de Book à partir de l'objet book
    const book = new Book({
      ...bookObject,
      // On associe l'ID de l'utilisateur authentifié à la création de l'objet book
      userId: req.auth.userId,
    });

    // Si un fichier d'image a été envoyé dans la requête
    if (req.file) {
      // On redimensionne l'image pour qu'elle fasse une largeur maximale de 800 pixels, puis on la convertit en format JPEG
      const imageBuffer = await sharp(req.file.buffer)
        .resize({ width: 800 })
        .toBuffer();
      // On génère un nom de fichier unique à partir d'un identifiant UUID version 4
      const filename = `${uuidv4()}.jpg`;
      // On enregistre l'image redimensionnée dans le dossier images, en utilisant le nom de fichier généré
      fs.writeFileSync(`images/${filename}`, imageBuffer);
      // On enregistre l'URL de l'image dans l'objet book, en utilisant le protocole, le nom d'hôte et le nom de fichier généré
      book.imageUrl = `${req.protocol}://${req.get("host")}/images/${filename}`;
    }

    // On enregistre l'objet book dans la base de données
    await book.save();
    res.status(201).json({ message: "Objet enregistré !" });
  } catch (error) {
    console.log(error);
    res.status(401).json({ error });
  }
};

exports.modifyBook = async (req, res, next) => {
  try {
    // Récupère le livre correspondant à l'ID fourni dans les paramètres de la requête.
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ message: "Livre non trouvé" });
    }
    // Récupère le nom de fichier de l'image actuelle du livre.
    const filename = book.imageUrl.split("/images/")[1];
    if (book.userId !== req.auth.userId) {
      return res.status(403).json({ message: "Non autorisé" });
    }

    let bookObject;
    if (req.file) {
      // Si un fichier est envoyé avec la requête, met à jour l'image associée au livre avec la nouvelle image.
      bookObject = JSON.parse(req.body.book);
      const imageBuffer = await sharp(req.file.buffer)
        .resize({ width: 800 })
        .toBuffer();
      if (`images/${filename}`) {
        // Supprime l'ancienne image associée au livre.
        fs.unlinkSync(`images/${filename}`);
      }
      // Crée un nouveau nom de fichier unique pour la nouvelle image et l'enregistre sur le disque.
      const newFilename = `${uuidv4()}.jpg`;
      fs.writeFileSync(`images/${newFilename}`, imageBuffer);
      // Met à jour l'objet du livre avec le nouveau chemin d'accès à l'image.
      bookObject = {
        title: bookObject.title,
        author: bookObject.author,
        year: bookObject.year,
        genre: bookObject.genre,
        imageUrl: `${req.protocol}://${req.get("host")}/images/${newFilename}`,
      };
    } else {
      // Si aucun fichier n'est envoyé avec la requête, met simplement à jour les autres propriétés du livre.
      bookObject = req.body;
      bookObject = {
        title: bookObject.title,
        author: bookObject.author,
        year: bookObject.year,
        genre: bookObject.genre,
      };
    }
    // Met à jour le livre dans la base de données avec les nouvelles informations.
    await book.updateOne(bookObject);
    res.status(200).json({ message: "Livre modifié" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error });
  }
};

exports.deleteBook = (req, res, next) => {
  Book.findOne({ _id: req.params.id })
    .then((book) => {
      if (book.userId != req.auth.userId) {
        res.status(403).json({ message: "Not authorized" });
      } else {
        const filename = book.imageUrl.split("/images/")[1];
        fs.unlink(`images/${filename}`, () => {
          Book.deleteOne({ _id: req.params.id })
            .then(() => {
              res.status(200).json({ message: "Objet supprimé !" });
            })
            .catch((error) => res.status(401).json({ error }));
        });
      }
    })
    .catch((error) => {
      res.status(500).json({ error });
    });
};

exports.getOneBook = (req, res, next) => {
  Book.findOne({ _id: req.params.id })
    .then((book) => res.status(200).json(book))
    .catch((error) => res.status(404).json({ error }));
};

exports.getAllBooks = (req, res, next) => {
  Book.find()
    .then((books) => res.status(200).json(books))
    .catch((error) => res.status(400).json({ error }));
};

exports.rating = (req, res, next) => {
  const raterId = req.body.userId; // L'ID de l'utilisateur qui donne une note
  const grade = req.body.rating; // La note donnée par l'utilisateur
  const token = req.headers.authorization.split(" ")[1]; // Le token d'authentification
  const decodedToken = jwt.verify(token, process.env.JWT_TOKEN); // Décoder le token pour récupérer l'ID de l'utilisateur
  const userId = decodedToken.userId; // L'ID de l'utilisateur qui est authentifié

  Book.findOne({ _id: req.params.id }) // Recherche le livre à noter par son ID
    .then((book) => {
      const existingRating = book.ratings.find(
        (rating) => rating.userId === raterId
      ); // Vérifier si l'utilisateur a déjà noté ce livre

      if (existingRating || userId !== raterId) {
        // Si l'utilisateur a déjà noté ce livre ou n'est pas l'utilisateur authentifié, renvoyer une erreur
        res.status(403).json({ message: "Vous avez déjà noté ce livre" });
      } else {
        // Si l'utilisateur n'a pas encore noté le livre, calculer la nouvelle note moyenne pour le livre
        const totalRating = book.ratings.reduce(
          (acc, rating) => acc + rating.grade,
          0
        );
        const averageRating = (
          (totalRating + grade) /
          (book.ratings.length + 1)
        ).toFixed(1);

        // Mettre à jour la note moyenne et la liste des notes pour le livre
        book.averageRating = averageRating;
        Book.updateOne(
          { _id: req.params.id },
          {
            averageRating: averageRating,
            $push: { ratings: { userId: raterId, grade: grade } },
          }
        )
          .then(() => {
            exports.getOneBook(req, res, req.params.id); // Récupérer les informations mises à jour pour le livre
          })
          .catch((error) => {
            res.status(400).json({ error });
          });
      }
    })
    .catch((error) => {
      res.status(400).json({ error });
    });
};

exports.getBestRating = (req, res, next) => {
  Book.find()
    // Permet de trier selon leur note "averageRating" les livres, puis de prendre les 3 premiers, par ordre décroissant
    .sort({ averageRating: -1 })
    .limit(3)
    .then((books) => {
      res.status(200).json(books);
    })
    .catch((error) => {
      res.status(400).json({ error });
    });
};
