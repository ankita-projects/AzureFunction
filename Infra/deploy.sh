#!/bin/bash
az deployment group create --resource-group Ankita-RG --template-file Image-processor-infra.bicep  --query properties.outputs.sqlRoleAssignmentId