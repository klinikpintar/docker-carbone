function setLoading(state) {
    const initial = document.getElementById('initial')
    if (!initial) { return }

    if (state) {
        initial.innerHTML = '<td colspan="3" align="center">Loading...</td>';
    } else {
        initial.innerHTML = '<td colspan="3" align="center">Tidak ada data</td>';
    }
}

function setContent(data) {
    const tbody = document.getElementById('tbody')
    const select = document.getElementById('template')
    tbody.innerHTML = ''
    select.innerHTML = '<option value="">--SELECT--</option>'
    data.forEach((file, i) => {
        tbody.innerHTML += `
            <tr>
                <th>${i + 1}</th>
                <td>${file}</td>
                <td>
                    <button class="btn btn-primary btn-sm test" data-file="${file}">Test</button>
                    <button type="submit" class="btn btn-secondary btn-sm" onclick="window.open('/download/${file}')">Download</button>
                    <button class="btn btn-danger btn-sm delete" data-file="${file}">Delete</button>
                </td>
            </tr>
        `
        select.innerHTML += `<option>${file}</option>`
    })

    const deletes = document.getElementsByClassName("delete")
    for (let btn of deletes) {
        btn.addEventListener('click', askDelete)
    }
    const tests = document.getElementsByClassName("test")
    for (let btn of tests) {
        btn.addEventListener('click', testTemplate)
    }
}

async function getData () {
    try {
        setLoading(true)
        const response = await fetch('/template', { method: "GET" })
        if (response.status === 200) {
            const data = await response.json()
            if (data && data.length) {
                setContent(data)
            }
        }
    } finally {
        setLoading(false)
    }
}

const btnUpload = document.getElementById('upload')
btnUpload.addEventListener('click', uploadFile)
async function uploadFile() {
    const file = document.getElementById('inputFile')
    if (file.files.length !== 1) {
        window.alert('invalid input value')
        return
    }

    let formData = new FormData()           
    formData.append("template", file.files[0])
    try {
        await fetch('/template', {
          method: "POST", 
          body: formData
        })
        file.value = ''
        const modalEL = document.getElementById('modal')
        const modal = bootstrap.Modal.getInstance(modalEL)
        modal.hide()
        getData()
    } catch (error) {
        window.alert('Error upload file')
    }
}

async function askDelete (e) {
    const ask = window.confirm('Are you sure?')
    if (ask) {
        const target = e.target
        const file = target.getAttribute('data-file')
        try {
            await fetch(`/template/${file}`, {
              method: "DELETE"
            })
            getData()
        } catch (error) {
            window.alert('Error delete file')
        }
    }
}

function fillForm(file) {
    const template = document.getElementById('template')
    const filename = document.getElementById('filename')
    const imagesReplace = document.getElementById('imagesReplace')
    const json = document.getElementById('jsonData')
    const options = document.getElementById('jsonOptions')
    template.value = file
    filename.value = `test-${file}`
    imagesReplace.value = '[]'
    json.value = '{}'
    options.value = '{}'
}

function fillJson(file) {
    const formData = document.getElementById('formData')
    formData.value = `{
    "template": "${file}",
    "filename": "test-${file}",
    "imagesReplace": [],
    "json": {},
    "options": "{}"
}`
}

async function testTemplate (e) {
    const target = e.target
    const file = target.getAttribute('data-file')
    fillForm(file)
    fillJson(file)
    setTimeout(() => {
        const modalEL = document.getElementById('modal-test')
        const modal = new bootstrap.Modal(modalEL)
        modal.show()
    }, 10)
}


function displayForm(as) {
    const form = document.getElementById('form')
    const json = document.getElementById('json')
    form.style.display = as === 'form' ? 'block' : 'none'
    json.style.display = as === 'form' ? 'none' : 'block'
}

const asForm = document.getElementById('fieldAsForm')
const asJson = document.getElementById('fieldAsJson')
asForm.addEventListener('click', () => displayForm('form'))
asJson.addEventListener('click', () => displayForm('json'))

const btnTest = document.getElementById('test')
btnTest.addEventListener('click', downloadTest)
async function downloadTest (e) {
    const fieldAs = document.querySelector('input[name="fieldAs"]:checked').value
    const target = e.target
    let data = null

    target.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Testing'
    if (fieldAs === 'form') {
        const template = document.getElementById('template')
        const filename = document.getElementById('filename')
        const json = document.getElementById('jsonData')
        const options = document.getElementById('jsonOptions')
        data = {
            template: template.value,
            filename: filename.value,
            json: JSON.parse(json.value),
            options: JSON.parse(options.value),
        }
    } else {
        const formData = document.getElementById('formData')
        data = JSON.parse(formData.value)
    }

    try {
        const asDownload = document.getElementById('asDownload').checked ? '?download=true' : ''
        const response = await fetch(`/generate${asDownload}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        })

        target.innerHTML = 'Test'

        if (response.status === 200) {
            const download = response.headers.get('Content-Disposition')
            if (download) {
                const resFilename = download.split('filename=')[1]
                const blob = await response.blob()
                const url = window.URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = resFilename
                document.body.appendChild(a)
                a.click()
                a.remove()
            } else {
                const data = await response.json()
                window.alert(`URL: ${data.url}`)
            }

            const modalEL = document.getElementById('modal-test')
            const modal = bootstrap.Modal.getInstance(modalEL)
            modal.hide()
            getData()
        } else {
            window.alert('Error download file')
        }
    } catch (error) {
        target.innerHTML = 'Test'
        window.alert('Error test template')
    }
}
getData()
