//https://ethereum.stackexchange.com/questions/48627/how-to-catch-revert-error-in-truffle-test-javascript

const PREFIX = "Returned error: VM Exception while processing transaction: ";

async function tryCatch(promise, userMessage, message) {
    try {
        await promise;
        throw null;
    }
    catch (error) {
        assert(error, userMessage ?? "Expected an error but did not get one");
        assert(error.message.startsWith(PREFIX + message), "Expected an error starting with '" + PREFIX + message + "' but got '" + error.message + "' instead");
    }
};

module.exports = {
    catchRevert            : async function(promise, userMessage) {await tryCatch(promise, userMessage, "revert"             );},
    catchOutOfGas          : async function(promise, userMessage) {await tryCatch(promise, userMessage, "out of gas"         );},
    catchInvalidJump       : async function(promise, userMessage) {await tryCatch(promise, userMessage, "invalid JUMP"       );},
    catchInvalidOpcode     : async function(promise, userMessage) {await tryCatch(promise, userMessage, "invalid opcode"     );},
    catchStackOverflow     : async function(promise, userMessage) {await tryCatch(promise, userMessage, "stack overflow"     );},
    catchStackUnderflow    : async function(promise, userMessage) {await tryCatch(promise, userMessage, "stack underflow"    );},
    catchStaticStateChange : async function(promise, userMessage) {await tryCatch(promise, userMessage, "static state change");},
};