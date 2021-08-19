const fs = require("fs");
const _ = require("lodash");
const Aimastering = require('aimastering');
const program = require('commander');
const srs = require('secure-random-string');

// parse command line arguments
program
    .option('-i, --input <s>', 'Input audio file path')
    .option('-o, --output <s>', 'Output audio file path')
    .parse(process.argv);
if (program.input.length === 0) {
    program.help();
}

// Call API with promise interface
const callApiDeferred = async function (api, method) {
    const apiArgments = Array.prototype.slice.call(arguments, 2);

    return new Promise((resolve, reject) => {
        const callback = (error, data, response) => {
            if (error) {
                reject(error, response);
            } else {
                resolve(data, response);
            }
        };
        const args = _.flatten([
            apiArgments,
            callback
        ]);

        method.apply(api, args);
    });
};

const sleep = async function (ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
};

const main = async function () {
    // configure API client
    const client = Aimastering.ApiClient.instance;
    const bearer = client.authentications['bearer'];
    // bearer.apiKey = process.env.AIMASTERING_ACCESS_TOKEN;

    // API key must be 'guest_' + [arbitrary string]
    // Unless the API key is leaked, the data will not be visible to others.
    bearer.apiKey = 'guest_' + srs({length: 32})

    // create api
    const audioApi = new Aimastering.AudioApi(client);
    const masteringApi = new Aimastering.MasteringApi(client);

    // upload input audio
    const inputAudioData = fs.createReadStream(program.input);
    const inputAudio = await callApiDeferred(audioApi, audioApi.createAudio, {
        'file': inputAudioData,
    });
    console.error(inputAudio);

    // start mastering
    let mastering = await callApiDeferred(masteringApi, masteringApi.createMastering, inputAudio.id, {
        'mode': 'default',
    });
    console.error(mastering);

    // wait for the mastering completion
    while (mastering.status === 'waiting' || mastering.status === 'processing') {
        mastering = await callApiDeferred(masteringApi, masteringApi.getMastering, mastering.id);
        console.error('waiting for the mastering completion progression: '
            + (100 * mastering.progression).toFixed() + '%');
        await sleep(5000);
    }

    // download output audio
    const outputAudioData = await callApiDeferred(audioApi, audioApi.downloadAudio, mastering.output_audio_id);
    fs.writeFileSync(program.output, outputAudioData);

    console.error('the output file was written to ' + program.output);
};

main();
