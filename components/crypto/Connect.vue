<style scoped>
  div {
    color: white;
  }
</style>

<template>
  <div>
    TEST
  </div>
</template>

<script> 
  import WalletConnectProvider from "@walletconnect/web3-provider";


  export default {
    // props: ['']
    // https://docs.walletconnect.com/quick-start/dapps/web3-provider,
    mounted() {
      //  Create WalletConnect Provider
      const provider = new WalletConnectProvider({
        infuraId: "27e484dcd9e3efcfd25a83a78777cdf1",
      });

      //  Enable session (triggers QR Code modal)
      provider.enable();
    },
    data() {
      return {
      }
    },
    methods: {
    }
  }
  // https://developer.algorand.org/docs/get-details/walletconnect/
  // import WalletConnect from "@walletconnect/client";
  // import QRCodeModal from "algorand-walletconnect-qrcode-modal";
  // import algosdk from "algosdk";
  // import { formatJsonRpcRequest } from "@json-rpc-tools/utils";

  // // Create a connector
  // const connector = new WalletConnect({
  //     bridge: "https://bridge.walletconnect.org", // Required
  //     qrcodeModal: QRCodeModal
  // });

  // // Check if connection is already established
  // if (!connector.connected) {
  //     // create new session
  //     connector.createSession();
  // }

  // // Subscribe to connection events
  // connector.on("connect", (error, payload) => {
  //     if (error) {
  //         throw error;
  //     }

  //     // Get provided accounts
  //     const { accounts } = payload.params[0];
  //     });

  //     connector.on("session_update", (error, payload) => {
  //     if (error) {
  //         throw error;
  //     }

  //     // Get updated accounts 
  //     const { accounts } = payload.params[0];
  //     });

  //     connector.on("disconnect", (error, payload) => {
  //     if (error) {
  //         throw error;
  //     }
  // });
</script>