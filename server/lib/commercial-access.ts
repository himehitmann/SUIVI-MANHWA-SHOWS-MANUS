export type AccessMode = "paid" | "personal";
/** Commercial servers default to paid access; self-hosted personal use is explicit. */
export function accessMode(value=process.env.YOMU_ACCESS_MODE,environment=process.env.NODE_ENV):AccessMode {
  if(value===undefined||value==="")return environment==="production"?"paid":"personal";
  if(value!=="paid"&&value!=="personal")throw new Error("YOMU_ACCESS_MODE must be paid or personal");
  return value;
}
export function canWriteSync(mode:AccessMode,effectivePlan:"free"|"pro"|"lifetime"):boolean {
  return mode==="personal"||effectivePlan==="pro"||effectivePlan==="lifetime";
}
