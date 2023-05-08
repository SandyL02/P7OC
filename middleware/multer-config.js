const multer = require("multer");

// Définition d'un dictionnaire de types MIME autorisés avec leurs extensions de fichier correspondantes
const MIME_TYPES = {
  "image/jpg": "jpg",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Configuration de l'emplacement de stockage pour les fichiers envoyés
const storage = multer.memoryStorage();

// Configuration de l'objet multer pour filtrer les fichiers envoyés et les stocker au bon endroit
const upload = multer({
  storage: storage, // Emplacement de stockage configuré ci-dessus
  fileFilter: (req, file, cb) => {
    const isValid = !!MIME_TYPES[file.mimetype]; // Vérifie si le type MIME du fichier envoyé correspond à un type autorisé
    cb(null, isValid); // Appelle le callback avec l'indication que le fichier est valide ou non
  },
});

// Exporte une fonction middleware qui gère l'upload d'un seul fichier avec le nom "image"
module.exports = upload.single("image");
