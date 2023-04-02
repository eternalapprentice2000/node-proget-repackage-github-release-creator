# Promote Proget Package + Create github release node App

For the most part I am calling this app from octopus deploy in order to properly repackage
proget packages and then create a release in github.

This may assist you with similar endevours.  I had to do a few things weird because the repo structure is not ideal.
Many github repos have multiple projects, and multiple deployment packages.

Basically, when the application is built, using github actions, it will create a tag for the build.  Something like `build.1.2.3-best-12345.98`.
This is also the beta tag of the packages in proget.

When promoting the package its possible that the build for a specific deployment package needs to be repackaged but others do not.  So we take the build tag, get the commit sha,
then use that to create a new RELEASE tag, because you cannot associate multiple releases with the same tag, i had to create a clone for the tag for the specific release.

I am using the github action core for the variable import system, mostly because of sheer laziness.  There is no reason to use something better equipped for this purpose.

I am running this command from powershell in octopus to create the packages.  Usage Looks like this:

```powershell
    $workingDir = "c:\Octopus\tools\create_release_package"

    cd $workingDir

    $env:INPUT_GH_APP_ID        = $OctopusParameters["Deployment.Github.ReleaseCreator.AppId"]
    $env:INPUT_GH_INSTALL_ID    = $OctopusParameters["Deployment.Github.ReleaseCreator.InstallId"]
    $env:INPUT_GH_PEM_FILE      = "./gh.pem"
    $env:INPUT_PROGET_URL       = $OctopusParameters["Deployment.Proget.Uri"]
    $env:INPUT_PROGET_API_KEY   = $OctopusParameters["Deployment.Proget.ApiKey"]
    $env:INPUT_PROGET_FEED_NAME = "octopus-deploy"
    $env:INPUT_PACKAGE_NAME     = $OctopusParameters["Step.Package.Name"]
    $env:INPUT_PACKAGE_VERSION  = $OctopusParameters["Step.Package.Version"]
    $env:INPUT_GITHUB_OWNER     = $OctopusParameters["Step.Github.Owner"]
    $env:INPUT_GITHUB_REPO		= $OctopusParameters["Step.Github.Repo"]

    node main
```

if you find this and you think it might be useful, by all means.  However, unless Something weird happens where I need to update this app for my own reasons I will not be making any changes to it.

Thank you!!!


