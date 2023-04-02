import core     from "@actions/core";
import jwt      from "jsonwebtoken";
import axios    from "axios";
import fs       from "fs";

const { getInput } = core;
const { sign } = jwt;
const { post, get } = axios;
const { readFileSync } = fs;

const ghAppId           = getInput("gh_app_id");
const ghInstallId       = getInput("gh_install_id");
const ghPemFile         = getInput("gh_pem_file");

const progetApiUrl      = getInput("proget_url");
const progetApiKey      = getInput("proget_api_key");
const progetFeedName    = getInput("proget_feed_name");

const githubOwner       = getInput("github_owner");
const githubRepo        = getInput("github_repo");

const packageName       = getInput("package_name");
const packageVersion    = getInput("package_version");

var pemFileContent      = readFileSync(ghPemFile, "utf8");

let getGitHubAccessToken = async() =>{
    let payload = {
        iat: Math.floor(new Date().getTime() / 1000) - 60,
        exp: Math.floor(new Date().getTime() / 1000) + (2 * 60),
        iss: ghAppId
    };

    let signingOptions = {
        algorithm:  "RS256"
    };

    let token = sign(payload, pemFileContent, signingOptions);
    let url = `https://api.github.com/app/installations/${ghInstallId}/access_tokens`;
    let config = {
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        }
    };

    let accessTokenResults = await post(url, null, config)
        .then((result) => {
            return result.data;
        })
        .catch((err) => {
            console.log(err.response.statusText);
            throw "unable to get access token";
        });

    return accessTokenResults.token;
}

let getGitHubTagInfo = async(tagId, accessToken) => {
    let url = `https://api.github.com/repos/${githubOwner}/${githubRepo}/git/ref/tags/${tagId}`;
    let config = {
        headers: {
            "X-GitHub-Api-Version" : "2022-11-28",
            "Accept" : "application/vnd.github+json",
            "Authorization" : `Bearer ${accessToken}`
        }
    };

    let result = get(url, config)
        .then( (r) => {
            return r.data.object.sha;
        })
        .catch(err => {
            if (err.response.status === 404) {
                // valid response, its just not there
                return null;
            } else {
                console.log(err.response.statusText);
                throw "unable to check if tag exists"
            }
        });

    return result;
}

let createGitHubRelease = async(commitSha, releaseName, accessToken) => {
    let url = `https://api.github.com/repos/${githubOwner}/${githubRepo}/releases`;
    let config = {
        headers: {
            "X-GitHub-Api-Version" : "2022-11-28",
            "Accept" : "application/vnd.github+json",
            "Authorization" : `Bearer ${accessToken}`
        }
    };

    let derivedTagName = releaseName.replace(" ", ".").toLowerCase();

    let body = {
        target_commitish    : commitSha,
        name                : releaseName,
        tag_name            : derivedTagName
    }

    let result = post(url, body, config)
        .then( _ => {
            return true;
        })
        .catch(err => {
            throw err;
        });

    return result;

}

let checkProgetPackageExists = async() => {
    let url = `${progetApiUrl}/nuget/${progetFeedName}/Packages()?$format=json&filter=Id eq '${packageName}' and Version eq '${packageVersion}'`;
    let config = {
        headers: {
            "X-ApiKey": progetApiKey,
            "Content-Type" : "application/json"
        }
    }

    let results = await get(url, config)
        .then((r) => {
            return r.data;
        })
        .catch((err) => {
            console.log(err.response.statusText);
            throw "unable to check packages";
        });

    return results && results.d && results.d.results && results.d.results.length > 0;
}

let repackageProgetPackage = async(newVersion) => {
    let url = `${progetApiUrl}/api/repackaging/repackage`;
    let config = {
        headers: {
            "X-ApiKey": progetApiKey,
            "Content-Type" : "application/json"
        }
    };

    let body = {
        feed        : progetFeedName,
        name        : packageName,
        version     : packageVersion,
        newVersion  : newVersion,
        comments    : "repackaged by automation"
    }

    let results = post(url, body, config)
        .then( _ => {
            return true;
        }).catch (err => {
            return false;
        });
    
    return results;
}

let main = async() => {

    var packageExists = await checkProgetPackageExists().catch((err) => {throw err});
    if (!packageExists) throw "Unable to continue, cannot find the package in proget to promote";

    // gets the github access token
    let accessToken = await getGitHubAccessToken();
    console.log(`Found Access Token: ${accessToken}`);

    let buildTag = `build.${packageVersion}`.toLowerCase();
    let githubTagSha = await getGitHubTagInfo(buildTag, accessToken);

    if (githubTagSha === null) throw "unable to continue, github build tag does not exist, unable to create git release";

    //tag exists, lets do this.
    let newVersion = packageVersion.split("-")[0];
    console.log(`New Version: ${newVersion}`);

    let repackageResult = await repackageProgetPackage(newVersion);

    if (!repackageResult) throw "unable to continue, repackage result came back as false";

    // create release in github
    let ghReleaseName = `${packageName} ${newVersion}`;
    let releaseStatus = await createGitHubRelease(githubTagSha, ghReleaseName, accessToken);

    if (!releaseStatus) throw "Release not created... maybe it already exists?"
    
}

main().catch((err) => {console.error(err)});