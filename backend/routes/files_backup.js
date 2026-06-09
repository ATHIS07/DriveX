
const s3 = require("../config/s3");
const {
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand
} = require("@aws-sdk/client-s3");
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage()
});

router.post(
    "/upload",
    upload.single("file"),
    async (req, res) => {

        try {

            const s3Key =
                Date.now() +
                "-" +
                req.file.originalname;

            await s3.send(
                new PutObjectCommand({
                    Bucket: process.env.AWS_BUCKET_NAME,
                    Key: s3Key,
                    Body: req.file.buffer,
                    ContentType: req.file.mimetype
                })
            );

            const fileData = {
                id: uuidv4(),
                originalName: req.file.originalname,
                savedName: s3Key,
                size: req.file.size,
                uploadDate: new Date()
            };

            const filePath = path.join(
                __dirname,
                "..",
                "files.json"
            );

            let files = [];

            if (fs.existsSync(filePath)) {
                files = JSON.parse(
                    fs.readFileSync(filePath, "utf8")
                );
            }

            files.push(fileData);

            fs.writeFileSync(
                filePath,
                JSON.stringify(files, null, 2)
            );

            res.json({
                success: true,
                file: fileData
            });

        } catch (err) {

            console.error(err);

            res.status(500).json({
                success: false,
                message: err.message
            });

        }

    }
);
router.get("/files", (req, res) => {

    const filePath = path.join(
        __dirname,
        "..",
        "files.json"
    );

    try {

        const files = JSON.parse(
            fs.readFileSync(filePath, "utf8")
        );

        res.json(files);

    } catch (err) {

        res.json([]);

    }

});
router.get("/download/:id", async (req, res) => {

    const filePath = path.join(
        __dirname,
        "..",
        "files.json"
    );

    const files = JSON.parse(
        fs.readFileSync(filePath, "utf8")
    );

    const file = files.find(
        f => f.id === req.params.id
    );

    if (!file) {
        return res.status(404).json({
            message: "File not found"
        });
    }

    const command = new GetObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: file.savedName
});

s3.send(command)
.then(data => {

    res.setHeader(
        "Content-Disposition",
        `attachment; filename="${file.originalName}"`
    );

    data.Body.pipe(res);

})
.catch(err => {

    console.log(err);

    res.status(500).send("Download Failed");

});
});
router.delete("/files/:id", async (req, res) => {

    const filePath = path.join(
        __dirname,
        "..",
        "files.json"
    );

    let files = JSON.parse(
        fs.readFileSync(filePath, "utf8")
    );

    const file = files.find(
        f => f.id === req.params.id
    );

    if (!file) {
        return res.status(404).json({
            message: "File not found"
        });
    }

    try {

    console.log("Deleting:", file.savedName);

    const result = await s3.send(
        new DeleteObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: file.savedName
        })
    );

    console.log("S3 Delete Result:", result);

} catch (err) {

    console.log("S3 DELETE ERROR");
    console.log(err);

}

files = files.filter(
    f => f.id !== req.params.id
);
    files = files.filter(
        f => f.id !== req.params.id
    );

    fs.writeFileSync(
        filePath,
        JSON.stringify(files, null, 2)
    );

    res.json({
        success: true
    });

});
router.put("/files/:id", async (req, res) => {

    const { newName } = req.body;

    const filePath = path.join(
        __dirname,
        "..",
        "files.json"
    );

    let files = JSON.parse(
        fs.readFileSync(filePath, "utf8")
    );

    const file = files.find(
        f => f.id === req.params.id
    );

    if (!file) {
        return res.status(404).json({
            message: "File not found"
        });
    }

    file.originalName = newName;

    fs.writeFileSync(
        filePath,
        JSON.stringify(files, null, 2)
    );

    res.json({
        success: true,
        file
    });

});
router.get("/share/:id", (req, res) => {

    const filePath = path.join(
        __dirname,
        "..",
        "files.json"
    );

    const files = JSON.parse(
        fs.readFileSync(filePath, "utf8")
    );

    const file = files.find(
        f => f.id === req.params.id
    );

    if (!file) {

        return res.status(404).send(
            "File not found"
        );

    }

    const command = new GetObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: file.savedName
});

s3.send(command)
.then(data => {

    res.setHeader(
        "Content-Disposition",
        `attachment; filename="${file.originalName}"`
    );

    data.Body.pipe(res);

})
.catch(err => {

    console.log(err);

    res.status(500).send("Share Failed");

});

});





router.get("/s3-test", async (req, res) => {

    try {

        const command = new PutObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: "test.txt",
            Body: "DriveX S3 Test"
        });

        await s3.send(command);

        res.send("S3 Working");

    } catch (err) {

        console.error(err);

        res.status(500).send(err.message);

    }

});




module.exports = router;