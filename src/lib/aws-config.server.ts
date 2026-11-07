export type AwsEnvironment = Record<string, string | undefined>;
export function awsValue(environment: AwsEnvironment, name: string) {
  return environment[name]?.trim() || environment[name.toLowerCase()]?.trim();
}
export function awsCredentials(environment: AwsEnvironment) {
  const region = awsValue(environment, "AWS_REGION") || awsValue(environment, "AWS_DEFAULT_REGION");
  const accessKeyId = awsValue(environment, "AWS_ACCESS_KEY_ID");
  const secretAccessKey = awsValue(environment, "AWS_SECRET_ACCESS_KEY");
  const sessionToken = awsValue(environment, "AWS_SESSION_TOKEN");
  if (!region || !accessKeyId || !secretAccessKey)
    throw new Error("AWS region and server credentials are required.");
  if (!/^[a-z]{2}(?:-[a-z]+)+-\d+$/.test(region)) throw new Error("AWS region is invalid.");
  return { region, accessKeyId, secretAccessKey, ...(sessionToken ? { sessionToken } : {}) };
}
export function companionAwsConfiguration(environment: AwsEnvironment) {
  const credentials = awsCredentials(environment);
  const guardrailIdentifier = awsValue(environment, "BEDROCK_GUARDRAIL_ID");
  const guardrailVersion = awsValue(environment, "BEDROCK_GUARDRAIL_VERSION");
  const summaryTable = awsValue(environment, "DYNAMODB_SUMMARY_TABLE");
  const safetyTable = awsValue(environment, "DYNAMODB_SAFETY_TABLE");
  if (!guardrailIdentifier || !guardrailVersion || !summaryTable || !safetyTable)
    throw new Error("Companion guardrail and DynamoDB configuration is incomplete.");
  if (!/^(DRAFT|[1-9]\d*)$/.test(guardrailVersion))
    throw new Error("Bedrock guardrail version is invalid.");
  return { credentials, guardrailIdentifier, guardrailVersion, summaryTable, safetyTable };
}
