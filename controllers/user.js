const bcrypt = require("bcrypt");
const User = require("../models/User");
const jwt = require("jsonwebtoken");

// Fonction middleware pour l'inscription d'un nouvel utilisateur
exports.signup = (req, res, next) => {
  bcrypt
    .hash(req.body.password, 10) // Hash le mot de passe reçu avec un niveau de salage de 10
    .then((hash) => {
      // Crée un nouvel objet User avec l'email et le mot de passe hashé
      const user = new User({
        email: req.body.email,
        password: hash,
      });
      // Enregistre le nouvel utilisateur dans la base de données
      user
        .save()
        .then(() => res.status(201).json({ message: "Utilisateur créé !" }))
        .catch((error) => res.status(400).json({ error }));
    })
    .catch((error) => res.status(500).json({ error }));
};

// Fonction middleware pour la connexion d'un utilisateur existant
exports.login = (req, res, next) => {
  User.findOne({ email: req.body.email }) // Recherche un utilisateur avec l'email fourni dans la base de données
    .then((user) => {
      if (!user) {
        return res.status(401).json({ error: "Utilisateur non trouvé !" });
      }
      bcrypt
        .compare(req.body.password, user.password) // Compare le mot de passe reçu avec le mot de passe hashé stocké dans la base de données
        .then((valid) => {
          if (!valid) {
            return res.status(401).json({ error: "Mot de passe incorrect !" });
          }
          // Si le mot de passe est correct, crée un token JWT pour l'utilisateur et l'envoie dans la réponse
          res.status(200).json({
            userId: user._id,
            token: jwt.sign({ userId: user._id }, process.env.JWT_TOKEN, {
              expiresIn: "24h",
            }),
          });
        })
        .catch((error) => res.status(500).json({ error }));
    })
    .catch((error) => res.status(500).json({ error }));
};
