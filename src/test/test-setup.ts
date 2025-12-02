// Handle BigInt serialization for Jest
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};
