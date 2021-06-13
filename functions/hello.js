exports.handler = async function(event, context) {

  // Wtf is this?

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Hello World" })
  };
}