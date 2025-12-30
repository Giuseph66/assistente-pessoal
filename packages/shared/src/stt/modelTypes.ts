export type ModelInstallProgress = {
  modelId: string;
  progress: number;
};

export type ModelInstallDone = {
  modelId: string;
  installPath: string;
};

export type ModelInstallError = {
  modelId: string;
  message: string;
};
