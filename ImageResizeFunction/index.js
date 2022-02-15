
const Jimp = require('jimp');
const { SecretClient } = require("@azure/keyvault-secrets");
const { DefaultAzureCredential } = require("@azure/identity");
const CosmosClient = require("@azure/cosmos").CosmosClient;
const stream = require('stream');
const { BlobServiceClient, BlockBlobClient } = require("@azure/storage-blob");
const axios = require('axios');
const sourceContainerName = "source-image-container";
const destinationContainerName = "destination-image-container";


const credential = new DefaultAzureCredential();
const keyVaultName = "imageProcesserKeyvalult";
const url = "https://" + keyVaultName + ".vault.azure.net";
const secretclient = new SecretClient(url, credential);


const smallImagePath = "small/"
const mediumImagePath = "medium/"
const largeImagePath = "large/"
const fs = require('fs');
const localFilePath = "D:/local/Temp/";


const ONE_MEGABYTE = 1024 * 1024;
const uploadOptions = { bufferSize: 4 * ONE_MEGABYTE, maxBuffers: 20 };
module.exports = async function (context, message) {
    const imageFileName = message ? message : `newImage${new Date().getTime()}` + '.jpeg';
    const connectionString = (await secretclient.getSecret("ImageStorageAccountConnectionString")).value;
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
        const mediumWidth = 400;
        const largeWidth = 800;
        await sourceBlockBlobClient.download(0).then(response =>
            new Promise((resolve, reject) => {
                response.readableStreamBody
                    .pipe(fs.createWriteStream(localFilePath + imageFileName))
                    .on('finish', () => resolve())
                    .on('error', e => reject(e));
            }));
        context.log("file Downloaded from BlobStore " + fs.existsSync(localFilePath + imageFileName))
        await Jimp.read(localFilePath + imageFileName).then((originalImage) => {
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