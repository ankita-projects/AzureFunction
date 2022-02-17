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
  name: 'image-processor-db-account'
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



