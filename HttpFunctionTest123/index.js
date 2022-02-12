const http = require('https');
const { BlobServiceClient, StorageSharedKeyCredential } = require("@azure/storage-blob");
const fs = require('fs');
const axios = require('axios');
const containerName = "source-image-container"
const account = "imageprocessingapp";
const accountKey = "dIk3vqIM4YLjbPdISzp+FqRqw2t8nB2yZZ+JHR7sQskjpAnjy9T9Afvc7l1xGkh/Uo9RaWCx4rgiWteWI7cmIw==";
const localFilePath = "D:/local/Temp/";
//Creating storage queue
const { QueueClient, QueueServiceClient } = require("@azure/storage-queue");
//queueConnectionString contains information that is required to connect to image processor storage account
const queueConnectionString = "DefaultEndpointsProtocol=https;AccountName=imageprocessingapp;AccountKey=dIk3vqIM4YLjbPdISzp+FqRqw2t8nB2yZZ+JHR7sQskjpAnjy9T9Afvc7l1xGkh/Uo9RaWCx4rgiWteWI7cmIw==;EndpointSuffix=core.windows.net";
//connecting
const queueServiceClient = QueueServiceClient.fromConnectionString(queueConnectionString);
const queueName = "image-procesing-queue";
const queueClient = queueServiceClient.getQueueClient(queueName);

module.exports = async function (context, req) {              //http trigger
    let unsplashAPIresponse = "empty";
    let unsplashResJson;
    const name = (req.query.name || (req.body && req.body.name));
    const imageFileName = name + `sImage${new Date().getTime()}` + '.jpeg';
    const unsplashAPIUrl = 'https://api.unsplash.com/photos/random?client_id=gK52De2Tm_dL5o1IXKa9FROBAJ-LIYqR41xBdlg3X2k';
    try {

        unsplashAPIresponse = await callAPI(unsplashAPIUrl);
        // holds response from server that is passed when Promise is resolved
        unsplashResJson = JSON.parse(unsplashAPIresponse);

        //unique name for file that will be created after we download 
        await downloadImage(unsplashResJson.urls.full, imageFileName);

        let blobServiceClient = createBlobServiceClinet();
        //you can check if the container exists or not, then determine to create it or not
        try {
            await createContainer(blobServiceClient)
        }
        catch (error) {
            context.log(error);
        }
        await uploadBlobContent(blobServiceClient, fs.readFileSync(localFilePath + imageFileName), imageFileName)
        fs.unlinkSync(localFilePath + imageFileName)
        await sendMessageToQueue(imageFileName);

    }
    catch (error) {
        // Promise rejected
        context.log(error);
    }
    context.log('JavaScript HTTP trigger function processed a request.');
    context.res = {
        body: "<!DOCTYPE html> <html> <head> </head> <body><h1>" + imageFileName + " Below Image uploaded to Blob storage </h1> " + "<img src='" + unsplashResJson.urls.small + "' ></img></body> </html>",
        headers: {
            'Content-Type': 'text/html; charset=utf-8'
        }

    };
}
function sendMessageToQueue(message) {
    return queueClient.sendMessage(Buffer.from(message).toString('base64'));
}

const downloadImage = (url, imageFileName) =>
    axios({
        url,
        responseType: 'stream',
    }).then(
        response =>
            new Promise((resolve, reject) => {
                response.data
                    .pipe(fs.createWriteStream(localFilePath + imageFileName))
                    .on('finish', () => resolve())
                    .on('error', e => reject(e));
            }),
    );
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