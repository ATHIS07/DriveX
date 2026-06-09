const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const fileRoutes = require("./routes/files");

app.use("/", fileRoutes);

app.get("/", (req, res) => {
    res.json({
        message: "DriveX Backend Running"
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(
        `Server running on port ${PORT}`
    );
});