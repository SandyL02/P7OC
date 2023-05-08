const jwt = require("jsonwebtoken");

// Exporte une fonction middleware qui vérifie si l'utilisateur est authentifié en vérifiant le token JWT
module.exports = (req, res, next) => {
  try {
    // Extrait le token JWT de l'en-tête Authorization de la requête
    const token = req.headers.authorization.split(" ")[1];
    // Vérifie le token en utilisant la clé secrète du serveur stockée dans une variable d'environnement
    const decodedToken = jwt.verify(token, process.env.JWT_TOKEN);
    // Récupère l'ID utilisateur stocké dans le token décodé
    const userId = decodedToken.userId;
    // Ajoute l'ID utilisateur au corps de la requête pour qu'il puisse être utilisé par les middlewares ultérieurs
    req.auth = {
      userId: userId,
    };
    next();
  } catch (error) {
    res.status(401).json({ error });
  }
};
