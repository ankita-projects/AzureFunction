const http = require('https');
const { BlobServiceClient, StorageSharedKeyCredential } = require("@azure/storage-blob");
const fs = require('fs');
const containerName = "source-image-container"
const downloadFileSync = require('download-file-sync');
const account = "ankitaazunsplashtest";
const accountKey = "/3JWyw6kpRuJoHXJvpOhn/a519EbXJ8jQ9ggFJ5Tlt6KGLeiIi8oCFH7swFT0gPIaNDrvg5+mnLdjKHfIvEnSQ==";


module.exports = async function (context, req) {               //http trigger
    let unsplashAPIresponse = "empty";
    let unsplashAPIImageResponse = 'empty';
    const unsplashAPIUrl = 'https://api.unsplash.com/photos/random?client_id=gK52De2Tm_dL5o1IXKa9FROBAJ-LIYqR41xBdlg3X2k';
    try {
        unsplashAPIresponse = await callAPI(unsplashAPIUrl);
        // holds response from server that is passed when Promise is resolved
        let unsplashResJson = JSON.parse(unsplashAPIresponse);
        unsplashAPIImageResponse = unsplashResJson.urls.small;
        const imageFileName = `newImage${new Date().getTime()}` + '.jpeg';
        fs.writeFileSync(imageFileName, downloadFileSync(unsplashResJson.urls.small));
        let blobServiceClient = createBlobServiceClinet();
        //you can check if the container exists or not, then determine to create it or not
        try {
            await createContainer(blobServiceClient)
        }
        catch (error) {
            context.log(error);
        }
        await uploadBlobContent(blobServiceClient, fs.readFileSync(imageFileName), imageFileName)
    }
    catch (error) {
        // Promise rejected
        context.log(error);
    }
    context.log('JavaScript HTTP trigger function processed a request.');

    const name = (req.query.name || (req.body && req.body.name));

    context.res = {
        // status: 200, /* Defaults to 200 */
        body: unsplashAPIresponse
    };
}


function createBlobServiceClinet() {
    const sharedKeyCredential = new StorageSharedKeyCredential(account, accountKey);
    return new BlobServiceClient(
        // When using AnonymousCredential, following url should include a valid SAS or support public access
        `https://${account}.blob.core.windows.net`,
        sharedKeyCredential
    );
}
function createContainer(blobServiceClient) {
    const containerClient = blobServiceClient.getContainerClient(containerName);
    return containerClient.create();
}

function uploadBlobContent(blobServiceClient, content, blobName) {

    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    return blockBlobClient.upload(content, Buffer.byteLength(content));
}

function callAPI(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (response) => {
            let chunks_of_data = [];  //asynchrons API 

            response.on('data', (fragments) => {
                chunks_of_data.push(fragments);
            });

            response.on('end', () => {
                let response_body = Buffer.concat(chunks_of_data);
                resolve(response_body.toString());
            });

            response.on('error', (error) => {
                reject(error);
            });
        });
    });
}