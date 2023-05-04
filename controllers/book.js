const Book = require("../models/Book");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const sharp = require("sharp");
const { v4: uuidv4 } = require("uuid");

exports.createBook = async (req, res, next) => {
  try {
    const bookObject = JSON.parse(req.body.book);
    delete bookObject._id;
    delete bookObject._userId;
    const book = new Book({
      ...bookObject,
      userId: req.auth.userId,
    });

    if (req.file) {
      const imageBuffer = await sharp(req.file.buffer)
        .resize({ width: 800 })
        .toBuffer();
      const filename = `${uuidv4()}.jpg`;
      fs.writeFileSync(`images/${filename}`, imageBuffer);
      book.imageUrl = `${req.protocol}://${req.get("host")}/images/${filename}`;
    }

    await book.save();
    res.status(201).json({ message: "Objet enregistré !" });
  } catch (error) {
    console.log(error);
    res.status(401).json({ error });
  }
};

exports.modifyBook = async (req, res, next) => {
  console.log(req.params);
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ message: "Livre non trouvé" });
    }
    const filename = book.imageUrl.split("/images/")[1];
    if (book.userId !== req.auth.userId) {
      return res.status(403).json({ message: "Non autorisé" });
    }
    console.log(book);
    let bookObject = JSON.parse(book);
    delete bookObject._userId;
    delete bookObject.ratings;
    delete bookObject.averageRating;
    if (req.file) {
      const imageBuffer = await sharp(req.file.buffer)
        .resize({ width: 800 })
        .toBuffer();
      if (`images/${filename}`) {
        fs.unlinkSync(`images/${filename}`);
      }
      const newFilename = `${uuidv4()}.jpg`;
      fs.writeFileSync(`images/${newFilename}`, imageBuffer);
      bookObject = {
        ...bookObject,
        imageUrl: `${req.protocol}://${req.get("host")}/images/${newFilename}`,
      };
    }
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
  const raterId = req.body.userId;
  const grade = req.body.rating;
  const token = req.headers.authorization.split(" ")[1];
  const decodedToken = jwt.verify(token, process.env.JWT_TOKEN);
  const userId = decodedToken.userId;

  Book.findOne({ _id: req.params.id })
    .then((book) => {
      const existingRating = book.ratings.find(
        (rating) => rating.userId === raterId
      );

      if (existingRating || userId !== raterId) {
        // L'utilisateur a déjà noté ce livre
        res.status(403).json({ message: "Vous avez déjà noté ce livre" });
      } else {
        // Calculer la nouvelle note moyenne pour le livre
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
            exports.getOneBook(req, res, req.params.id);
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
