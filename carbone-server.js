const fs = require('fs')
const path = require('path')
const cors = require('cors')
const dotenv = require('dotenv')
const multer = require('multer')
const express = require('express')
const nativeAuth = require('basic-auth')
const basicAuth = require('express-basic-auth')
const generate = require('./generator')

const app = express()
dotenv.config()

const username = process.env.USER || 'user'
const password = process.env.PASSWORD || 'password'
const users = {}
users[username] = password
const auth = basicAuth({
  users,
  unauthorizedResponse: {
    message: 'Bad credentials',
  },
})

app.use(
  cors({
    origin: process.env.CORS_WHITELIST_ORIGIN,
  })
)

app.use(express.urlencoded({ extended: false }))
app.use(express.json({ limit: '50mb' }))

app.get('/', function(req, res) {
  let user = nativeAuth(req)
  if (user === undefined || user['name'] !== username || user['pass'] !== password) {
    res.statusCode = 401
    res.setHeader('WWW-Authenticate', 'Basic realm="Node"')
    res.end('Unauthorized')
  } else {
    res.sendFile(path.join(__dirname, 'ui/index.html'))
  }
})

app.get('/js', function(req, res) {
  res.sendFile(path.join(__dirname, 'ui/script.js'))
})

app.get('/download/:file', function(req, res) {
  const filePath = path.join(__dirname, 'templates/' + req.params.file)
  if (fs.existsSync(filePath)) {
    res.download(filePath, req.params.file)
  } else {
    res.statusCode = 404
    res.json({ message: 'File not found' })
  }
})

app.delete('/template/:file', function(req, res) {
  const filePath = path.join(__dirname, 'templates/' + req.params.file)
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
    res.json({ message: 'File deleted' })
  } else {
    res.statusCode = 404
    res.json({ message: 'File not found' })
  }
})

app.get('/template', auth, async (req, res) => {
  const files = await fs.promises.readdir(`./templates`)
  res.send(files.filter(file => file !== '.gitignore'))
})

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, './templates')
  },
  filename(req, file = {}, cb) {
    const { originalname } = file
    const fileExtension = (originalname.match(/\.+[\S]+$/) || [])[0]
    cb(null, `${originalname.trim()}__${Date.now()}${fileExtension}`)
  },
})

const upload = multer({ storage: storage })
app.post('/template', auth, upload.single(`template`), async (req, res) => {
  res.send('Template Uploaded!')
})

app.get('/generate', auth, async (req, res) => {
  const template = req.query.template
  const filename = req.query.filename
  const imagesReplace = JSON.parse(req.query.imagesReplace)
  const data = JSON.parse(req.query.json)
  const options = JSON.parse(req.query.options)

  return generate(res, { template, filename, data, options, imagesReplace }, req.query.download === 'true')
})

app.post('/generate', auth, async (req, res) => {
  const template = req.body.template
  const filename = req.body.filename
  const data = req.body.json
  const options = req.body.options
  const imagesReplace = req.body.imagesReplace

  return generate(res, { template, filename, data, options, imagesReplace }, req.query.download === 'true')
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`)
})
