const fs = require('fs')
const path = require('path')
const mime = require('mime-types')
const carbone = require('carbone')
const util = require('util')
const AWS = require('aws-sdk')
const exec = util.promisify(require('child_process').exec)

const replaceImages = async (template, images) => {
  let executed = false
  let newTemplate = template.split('.')
  newTemplate = 'temp.' + newTemplate[newTemplate.length - 1]

  for (let i = 0; i < images.length; i++) {
    let usedTemplate = i === 0 ? template : `/temp/${newTemplate}`
    const image = images[i]
 
    try {
      await exec(
        `sh replace-image.sh ${usedTemplate} ${newTemplate} ${image.destination} ${image.source}`
      )

      if (!executed) {
        executed = true
      }
    } catch (err) {
      throw new Error(err)
    }
  }

  if (executed) {
    // temp is temporary folder defined in shell script above
    return `temp/${newTemplate}`
  }  

  return template
}
  
const render = (template, data, options) => {
  return new Promise((resolve, reject) => {
    carbone.render(template, data, options, (err, result) => {
      if (err) {
        reject(new Error(err))
      } else {
        if (template.includes('temp/')) {
          fs.rmSync(path.join(__dirname, 'temp'), { recursive: true, force: true });
        }
        resolve(result)
      }
    })
  })
}

const saveToS3 = (Body, Key) => {
  const s3Client = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
  })

  return new Promise((resolve, reject) => {
    s3Client.upload({
      ACL: 'public-read',
      Bucket: process.env.AWS_BUCKET_NAME,
      Body,
      Key
    }, function (err, data) {
      if (err) {
        reject(new Error(err))
      } else {
        resolve(data.Location)
      }
    })
  })
}

module.exports = async (res, params, download = false) => {
  let { template, filename, data, options, imagesReplace } = params

  if (!template.includes('templates')) {
    template = `templates/${template}`
  }

  if (imagesReplace) {
    template = await replaceImages(template, imagesReplace)
  }

  if (options.convertTo) {
    //change filename extension of converted (ie to PDF)
    filename = filename.replace(/\.[^/.]+$/, '')
    filename = filename + '.' + options.convertTo
  }

  try {
    const buffer = await render(template, data, options)

    if (download) {
      res.set({
        'Access-Control-Expose-Headers': 'Content-Disposition',
        'Content-Type': mime.lookup(filename),
        'Content-Disposition': `attachment; filename=${filename.split('/').pop()}`
      })
      res.end(buffer)
    } else {
      try {
        const url = await saveToS3(buffer, filename)
        res.json({ url })
      } catch (e) {
        console.log(e)
        res.statusCode = 500
        res.json({ message: e.message || 'Error save to S3' })
      }
    }
  } catch (e) {
    res.statusCode = 500
    res.json({ message: e.message })
  }
}
