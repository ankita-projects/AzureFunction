const Jimp = require('jimp');
const stream = require('stream');
const { BlobServiceClient, StorageSharedKeyCredential } = require("@azure/storage-blob");
const axios = require('axios');
const containerName = "destination-image-container";
const connectionString = "DefaultEndpointsProtocol=https;AccountName=ankitaazunsplashtest;AccountKey=/3JWyw6kpRuJoHXJvpOhn/a519EbXJ8jQ9ggFJ5Tlt6KGLeiIi8oCFH7swFT0gPIaNDrvg5+mnLdjKHfIvEnSQ==;EndpointSuffix=core.windows.net":
const imageFileName = `newThumbNail${new Date().getTime()}` + '.jpeg'; 

const ONE_MEGABYTE = 1024 * 1024;
const uploadOptions = { bufferSize: 4 * ONE_MEGABYTE, maxBuffers: 20 };

module.exports = async function (context, myBlob) {
    context.log("JavaScript blob trigger function processed blob \n Blob:", context.bindingData.blobTrigger, "\n Blob Size:", myBlob.length, "Bytes");
    await axios.get('https://enupjdfwylrdhir.m.pipedream.net', {
        headers: {
            'Test-Header': 'test-value',
            'fx-data': context.bindingData.blobTrigger,
            'fx-data-lenght': myBlob.length
        }
    });
    const widthInPixels = 100;
    Jimp.read(inputBlob).then((thumbnail) => {
        thumbnail.resize(widthInPixels, Jimp.AUTO);
        thumbnail.getBuffer(Jimp.MIME_PNG, async (err, buffer) => {
            const readStream = stream.PassThrough();
            readStream.end(buffer);
            const blobClient = new BlockBlobClient(connectionString, containerName, imageFileName);
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
};


