const fs = require("fs");
const SwaggerClient = require('swagger-client');
const program = require('commander');

// parse command line arguments
program
    .option('-i, --input <s>', 'Input audio file path')
    .option('-o, --output <s>', 'Output audio file path')
    .parse(process.argv);
if (program.input.length === 0) {
    program.help();
}

// settings
const accessToken = process.env.AIMASTERING_ACCESS_TOKEN;
const baseUrl = 'https://aimastering.com/api';
const specUrl = baseUrl + '/api_spec.json';

const createApiClient = async function () {
    return new SwaggerClient({
        authorizations: {
            bearer: 'Bearer ' + accessToken,
        },
        url: specUrl,
    });
};

const sleep = async function (ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
};

const main = async function () {
    // create API client
    const client = await createApiClient();

    // upload input audio
    const inputAudioData = fs.readFileSync(program.input);
    const inputAudio = await client.apis.audio.createAudio({
        file: inputAudioData,
    });
    console.error(inputAudio);

    // start mastering
    let mastering = await client.apis.mastering.createMastering({
        input_audio_id: inputAudio.id,
    });
    console.error(mastering);

    // wait for the mastering completion
    while (mastering.status === 'processing') {
        mastering = await client.apis.mastering.getMastering({ id: mastering.id });
        console.error('waiting for the mastering completion progression: '
            + (100 * mastering.progression).toFixed + '%');
        await sleep(1000);
    }

    // download output audio
    const outputAudio = await client.apis.audio.getAudio({ id: mastering.output_audio_id });
    console.error(outputAudio);
    const outputAudioData = await client.apis.audio.downloadAudio({ id: mastering.output_audio_id });
    fs.writeFileSync(program.output, outputAudioData);

    console.error('finished');
};

main();
