export async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, options);
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error(
      "Connection lost. Please try again; retrying won’t create a duplicate booking.",
      { cause: error },
    );
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      "The service returned an unexpected response. Please try again.",
    );
  }
  if (!response.ok) {
    const error = new Error(data.message || "Please try again.");
    error.code = data.error;
    throw error;
  }
  return data;
}
