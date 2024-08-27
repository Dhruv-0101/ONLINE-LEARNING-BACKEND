const multer = require("multer");
const path = require("path");

// Set storage engine for multer
const storage = multer.diskStorage({
  destination: "./uploads/videos/",
  filename: (req, file, cb) => {
    cb(
      null,
      file.fieldname + "-" + Date.now() + path.extname(file.originalname)
    );
  },
});

// Initialize multer upload variable
const upload = multer({
  storage: storage,
  limits: { fileSize: 1000000000 }, // Set file size limit (adjust as needed)
  fileFilter: (req, file, cb) => {
    checkFileType(file, cb);
  },
}).array("videos", 5); // Accept up to 5 videos

// Check file type function
function checkFileType(file, cb) {
  const filetypes = /mp4|mov|wmv|avi|mkv/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);
  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb("Error: Videos Only!");
  }
}

module.exports = upload;
