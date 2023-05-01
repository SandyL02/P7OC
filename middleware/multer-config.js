const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');

const MIME_TYPES = {
    'image/jpg': 'jpg',
    'image/jpeg': 'jpg',
    'image/png': 'png'
}

const storage = multer.diskStorage({
    destination: (req, file, callback) => {
        const fileSize = parseInt(req.headers["content-length"])
        if (file.mimetype !== 'image/jpg' && file.mimetype !== 'image/jpeg' && file.mimetype !== 'image/png') {
            return callback(new Error('Votre image doit être au format .jpg ou .png.'));
        }
        else {
            callback(null, 'images')
        }
    },

    filename: (req, file, callback) => {
        const name = uuidv4();
        const extension = MIME_TYPES[file.mimetype];

        callback(null, name + '.' + extension);
    }
});

module.exports = multer({storage: storage}).single('image');