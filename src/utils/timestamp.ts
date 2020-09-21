import fs from "fs";

export const getCurrentTimestamp = () => {
  return Math.floor(new Date().getTime() / 1000);
};

export const getPreviousTimestamp = (fileName: string) => {
  if (!fs.existsSync(fileName)) {
    fs.writeFileSync(fileName, getCurrentTimestamp().toString());
  }
  return parseInt(fs.readFileSync(fileName, "utf-8"));
};
