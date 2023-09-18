const path = require('path');
const core = require('@actions/core');
const exec = require('@actions/exec');
const axios = require('axios');
const GhostAdminApi = require('@tryghost/admin-api');

(async function main() {
    try {
        const url = core.getInput('api-url');
        const api = new GhostAdminApi({
            url,
            key: core.getInput('api-key'),
            version: 'v5.0',
            // Custom makeRequest implementation
            makeRequest({url, method, data, params = {}, headers = {}}) {
                return axios({
                    url,
                    method,
                    params,
                    data,
                    headers,
                    maxContentLength: 500000000,
                    maxBodyLength: 500000000,
                    paramsSerializer(parameters) {
                        return Object.keys(parameters).reduce((parts, key) => {
                            const val = encodeURIComponent([].concat(parameters[key]).join(','));
                            return parts.concat(`${key}=${val}`);
                        }, []).join('&');
                    }
                }).then((res) => {
                    return res.data;
                });
            }
        });
        const workingDir = core.getInput('working-directory');
        const basePath = path.join(process.env.GITHUB_WORKSPACE, workingDir);
        const pkgPath = path.join(process.env.GITHUB_WORKSPACE, workingDir, 'package.json');

        let zipPath = core.getInput('file');

        // Zip file was not provided - zip everything up!
        if (!zipPath) {
            const themeName = core.getInput('theme-name') || require(pkgPath).name;
            const themeZip = `${themeName}.zip`;
            const exclude = core.getInput('exclude') || '';
            zipPath = themeZip;

            // Create a zip
            await exec.exec(`zip -r ${themeZip} . -x *.git* *.zip yarn* npm* node_modules* *routes.yaml *redirects.yaml *redirects.json ${exclude}`, [], {cwd: basePath});
        }

        zipPath = path.join(basePath, zipPath);

        // Deploy it to the configured site
        await api.themes.upload({file: zipPath});
        console.log(`${zipPath} successfully uploaded.`); // eslint-disable-line no-console
    } catch (err) {
        console.error(JSON.stringify(err, null, 2)); // eslint-disable-line no-console
        process.exit(1);
    }
}());
