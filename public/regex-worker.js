self.onmessage = function (event) {
  const { options, query } = event.data;
  if (query.length > 120) {
    self.postMessage({
      error: "Keep your expression under 120 characters.",
      ids: [],
    });
    return;
  }
  try {
    const expression = new RegExp(query, "i");
    self.postMessage({
      ids: options.filter((x) => expression.test(x.label)).map((x) => x.value),
    });
  } catch {
    self.postMessage({
      error:
        "Invalid regular expression. Check brackets and special characters.",
      ids: [],
    });
  }
};
