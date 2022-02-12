
const Jimp = require('jimp');
const stream = require('stream');
const { BlobServiceClient, BlockBlobClient } = require("@azure/storage-blob");
const axios = require('axios');
const sourceContainerName = "source-image-container";
const destinationContainerName = "destination-image-container";
const connectionString = "DefaultEndpointsProtocol=https;AccountName=imageprocessingapp;AccountKey=dIk3vqIM4YLjbPdISzp+FqRqw2t8nB2yZZ+JHR7sQskjpAnjy9T9Afvc7l1xGkh/Uo9RaWCx4rgiWteWI7cmIw==;EndpointSuffix=core.windows.net";

const smallImagePath = "small/"
const mediumImagePath = "medium/"
const largeImagePath = "large/"
const fs = require('fs');
const localFilePath = "D:/local/Temp/";

const ONE_MEGABYTE = 1024 * 1024;
const uploadOptions = { bufferSize: 4 * ONE_MEGABYTE, maxBuffers: 20 };
module.exports = async function (context, message) {
    const imageFileName = message ? message : `newImage${new Date().getTime()}` + '.jpeg';
    try {
        context.log('Node.js queue trigger function processed work item', context.bindingData.id);
        await axios.get('https://enb31hpgmba4527.m.pipedream.net', {
            headers: {
                'Test-Header': 'test-value',
                'fx-data': message
            }
        });
        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        // Get a reference to a container
        const containerClient = blobServiceClient.getContainerClient(sourceContainerName);
        // Get a block blob client
        const sourceBlockBlobClient = containerClient.getBlockBlobClient(message);
        // OR access using context.bindings.<name>
        // context.log('Node.js queue trigger function processed work item', context.bindings.myQueueItem);
        const thumbnailWidth = 100;
        const mediumWidth = 300;
        const largeWidth = 500;
        await sourceBlockBlobClient.download(0).then(response =>
            new Promise((resolve, reject) => {
                response.readableStreamBody
                    .pipe(fs.createWriteStream(localFilePath + imageFileName))
                    .on('finish', () => resolve())
                    .on('error', e => reject(e));
            }));
        context.log("file Downloaded from BlobStore " + fs.existsSync(localFilePath + imageFileName))
        Jimp.read(localFilePath + imageFileName).then((originalImage) => {
            originalImage.resize(mediumWidth, Jimp.AUTO);
            originalImage.getBuffer(Jimp.MIME_JPEG, async (err, buffer) => {
                const readStream = stream.PassThrough();
                readStream.end(buffer);
                const blobClient = new BlockBlobClient(connectionString, destinationContainerName, mediumImagePath + "medium"+imageFileName);
                try {
                    await blobClient.uploadStream(readStream,
                        uploadOptions.bufferSize,
                        uploadOptions.maxBuffers,
                        { blobHTTPHeaders: { blobContentType: "image/jpeg" } });
                } catch (err) {
                    context.log(err.message);
                }
            });

            originalImage.resize(largeWidth, Jimp.AUTO);
            originalImage.getBuffer(Jimp.MIME_JPEG, async (err, buffer) => {
                const readStream = stream.PassThrough();
                readStream.end(buffer);
                const blobClient = new BlockBlobClient(connectionString, destinationContainerName, largeImagePath + "large"+imageFileName);
                try {
                    await blobClient.uploadStream(readStream,
                        uploadOptions.bufferSize,
                        uploadOptions.maxBuffers,
                        { blobHTTPHeaders: { blobContentType: "image/jpeg" } });
                } catch (err) {
                    context.log(err.message);
                }
            });

            originalImage.resize(thumbnailWidth, Jimp.AUTO);
            originalImage.getBuffer(Jimp.MIME_JPEG, async (err, buffer) => {
                const readStream = stream.PassThrough();
                readStream.end(buffer);
                const blobClient = new BlockBlobClient(connectionString, destinationContainerName, smallImagePath + "small"+imageFileName);
                try {
                    await blobClient.uploadStream(readStream,
                        uploadOptions.bufferSize,
                        uploadOptions.maxBuffers,
                        { blobHTTPHeaders: { blobContentType: "image/jpeg" } });
                } catch (err) {
                    context.log(err.message);
                }
            });
        });
        fs.unlinkSync(localFilePath + imageFileName)
        context.done();
    } catch (err) {
        context.log(err);
    }
};