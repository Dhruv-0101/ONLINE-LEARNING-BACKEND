const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(
      "mongodb+srv://dhruvgtuskillbuddy:XrnIPGY9tX0sVrv1@cluster0.dmm8ejv.mongodb.net/?appName=dbforskillbuddy",
    );
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (err) {
    console.error(`Error connecting to MongoDB: ${err.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
