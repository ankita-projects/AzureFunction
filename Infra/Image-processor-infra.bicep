param function_app_name string = 'image-processor-function-app'
param appservice_plan_name string = 'image-processor-app-service-app'
param app_insights_name string = 'image-processor-appinsights'
param image_storage_Db_account_name string = 'image-processor-db-account' 

var unique_string = uniqueString(resourceGroup().id)
var unique_function_name = '${function_app_name}-${unique_string}'
var unique_DB_account_name = '${image_storage_Db_account_name}-${unique_string}'

targetScope = 'resourceGroup'
resource imageStorageAccount 'Microsoft.Storage/storageAccounts@2020-08-01-preview' = {
  name: 'imageprostorageaccount1'
  location: resourceGroup().location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: true
    allowSharedKeyAccess: true
    largeFileSharesState: 'Enabled'
    networkAcls: {
      resourceAccessRules: []
      bypass: 'AzureServices'
      virtualNetworkRules: []
      ipRules: []
      defaultAction: 'Allow'
    }
    supportsHttpsTrafficOnly: true
    encryption: {
      services: {
        file: {
          keyType: 'Account'
          enabled: true
        }
        blob: {
          keyType: 'Account'
          enabled: true
        }
      }
      keySource: 'Microsoft.Storage'
    }
    accessTier: 'Hot'
  }
}

resource sourceImageStorageAccountContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2021-04-01' = {
  name: '${imageStorageAccount.name}/default/source-image-container'
  properties: {}
}

resource destinationImageStorageAccountContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2021-04-01' = {
  name: '${imageStorageAccount.name}/default/destination-image-container'
  properties: {}
}

resource imageQueue 'Microsoft.Storage/storageAccounts/queueServices/queues@2021-08-01' = {
  name: '${imageStorageAccount.name}/default/image-processing-queue'
  properties: {}
}


//CosmosDB database


resource imageStorageDbAccount 'Microsoft.DocumentDB/databaseAccounts@2021-04-15' = {
  name: unique_DB_account_name
  location: resourceGroup().location
  properties:{
    databaseAccountOfferType:'Standard'
    enableAutomaticFailover:false
    enableMultipleWriteLocations:false
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    locations: [
      {
        locationName: resourceGroup().location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
  }
}

resource imageStorageDB 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2021-06-15' = {
  name: '${imageStorageDbAccount.name}/image-processor-db'
  dependsOn: [
    imageStorageDbAccount
  ]
  properties:{
    resource:{
      id:'image-processor-db'
    }
  }
}

resource imageStorageDBContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2021-06-15' = {
  name:'${imageStorageDB.name}/image-container'
  dependsOn: [
    imageStorageDbAccount
    imageStorageDB
  ]
  properties:{
    resource:{
      id: 'image-container'
      partitionKey:{
        paths:[
          '/imageId'
        ]
        kind:'Hash'
      }
    }
  }
}

resource keyVault 'Microsoft.KeyVault/vaults@2019-09-01' = {
  name: 'imageProcesserKeyvalult2'
  location: resourceGroup().location
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: false // Using Access Policies model
    accessPolicies: [
      {
        tenantId: '14b9c9b3-f9f3-4635-ba89-1327fcf80e2e'
        objectId: '0e5a6635-c081-49c2-a7ba-4c6058d2ea8c'
        permissions: {
          secrets: [
            'all'
          ]
          certificates: [
            'all'
          ]
          keys: [
            'all'
          ]
        }
      }
    ]
    enabledForDeployment: true // VMs can retrieve certificates
    enabledForTemplateDeployment: true // ARM can retrieve values
    publicNetworkAccess: 'Enabled'
    enablePurgeProtection: true // Not allowing to purge key vault or its objects after deletion
    enableSoftDelete: false
    softDeleteRetentionInDays: 7
    createMode: 'default' // Creating or updating the key vault (not recovering)
  }
}

// Create a secret outside of key vault definition
resource ImageStorageAccountConnectionString 'Microsoft.KeyVault/vaults/secrets@2021-11-01-preview' = {
  name: 'ImageStorageAccountConnectionString'
  parent: keyVault // Pass key vault symbolic name as parent
  properties: {
    value: 'mySecretValue'
  }
}

resource ImageStorageAccountKey 'Microsoft.KeyVault/vaults/secrets@2021-11-01-preview' = {
  name: 'ImageStorageAccountKey'
  parent: keyVault // Pass key vault symbolic name as parent
  properties: {
    value: imageStorageAccount.listKeys().keys[0].value
  }
}

resource ImageStorageAccountName 'Microsoft.KeyVault/vaults/secrets@2021-11-01-preview' = {
  name: 'ImageStorageAccountName'
  parent: keyVault // Pass key vault symbolic name as parent
  properties: {
    value: imageStorageAccount.name
  }
}

resource ImageStorageDBAccountKey 'Microsoft.KeyVault/vaults/secrets@2021-11-01-preview' = {
  name: 'image-db-key'
  parent: keyVault // Pass key vault symbolic name as parent
  properties: {
    value: imageStorageDbAccount.listKeys().primaryMasterKey
  }
}
resource ImageStorageDBAccountEndpoint 'Microsoft.KeyVault/vaults/secrets@2021-11-01-preview' = {
  name: 'image-db-endpoint'
  parent: keyVault // Pass key vault symbolic name as parent
  properties: {
    value: imageStorageDbAccount.listConnectionStrings().connectionStrings[0].connectionString
  }
}

resource imageProcessorQueueName 'Microsoft.KeyVault/vaults/secrets@2021-11-01-preview' = {
  name: 'imageProcessorQueueName'
  parent: keyVault // Pass key vault symbolic name as parent
  properties: {
    value: imageQueue.name
  }
}

resource appservice_plan 'Microsoft.Web/serverfarms@2020-12-01' = {
  name: appservice_plan_name
  location:resourceGroup().location
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
}

resource app_insights 'Microsoft.Insights/components@2015-05-01' = {
  name: app_insights_name
  location: resourceGroup().location
  kind: 'web'
  properties: {
    Application_Type: 'web'
  }
}


resource function_app 'Microsoft.Web/sites@2020-12-01' = {
  name: unique_function_name
  location: resourceGroup().location
  kind: 'functionapp'
  identity: {
    type: 'SystemAssigned'
  }
  dependsOn: [
    imageStorageAccount
    appservice_plan
    app_insights
  ]
  properties: {
    serverFarmId: appservice_plan.id
    siteConfig: {
      appSettings: [
        {
          name: 'AzureWebJobsStorage'
          value: concat('DefaultEndpointsProtocol=https;AccountName=',  imageStorageAccount.name, ';AccountKey=', listKeys( imageStorageAccount.id, '2019-06-01').keys[0].value)
        }
        {
          name: 'APPINSIGHTS_INSTRUMENTATIONKEY'
          value: reference(app_insights.id, '2015-05-01').InstrumentationKey
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~3'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'node'
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~14'
        }
        {
          name: 'WEBSITE_RUN_FROM_PACKAGE'
          value: ''
        }
      ]
    }
  }
}





