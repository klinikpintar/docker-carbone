const carbone = require("carbone");
const express = require("express");
const fs = require("fs");
const multer = require("multer");
const basicAuth = require("express-basic-auth");
const AWS = require("aws-sdk");
const dotenv = require("dotenv");
const app = express();

dotenv.config();
AWS.config.update({ region: process.env.AWS_REGION });

const username = process.env.USER || "user";
const password = process.env.PASSWORD || "password";
const users = {};
users[username] = password;

app.use(
  basicAuth({
    users,
    unauthorizedResponse: {
      message: "Bad credentials",
    },
  })
);
app.use(express.urlencoded({ extended: false }));
app.use(express.json({ limit: "50mb" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

app.get("/", async (req, res) => {
  res.send("Welcome to Carbone Server");
});

app.get("/template", async (req, res) => {
  const files = await fs.promises.readdir(`./templates`);
  res.send(files);
});

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, "./templates");
  },
  filename(req, file = {}, cb) {
    const { originalname } = file;
    const fileExtension = (originalname.match(/\.+[\S]+$/) || [])[0];
    cb(null, `${originalname.trim()}__${Date.now()}${fileExtension}`);
  },
});
const upload = multer({ storage: storage });
app.post("/template", upload.single(`template`), async (req, res) => {
  res.send("Template Uploaded!");
});

app.all("/generate", async (req, res) => {
  if (req.method === "GET") {
    template = req.query.template;
    filename = req.query.filename;
    data = req.query.json;
    options = req.query.options;
  } else if (req.method === "POST") {
    template = req.body.template;
    filename = req.body.filename;
    data = req.body.json;
    options = req.body.options;
  } else {
    throw new Error("Method not supported");
  }

  if (options.convertTo) {
    filename = filename.replace(/\.[^/.]+$/, ""); //change filename extension of converted (ie to PDF)
    filename = filename + "." + options.convertTo;
  }

  carbone.render(template, data, options, async (err, result) => {
    if (err) {
      return console.log(err);
    }

    const s3 = new AWS.S3();
    s3.upload(
      {
        ACL: "public-read",
        Bucket: process.env.AWS_BUCKET_NAME,
        Body: result,
        Key: filename,
      },
      function (err, data) {
        res.send(data.Location);
      }
    );
  });
});
