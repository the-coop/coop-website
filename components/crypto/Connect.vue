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
  import WalletConnect from "@walletconnect/client";
  import QRCodeModal from "algorand-walletconnect-qrcode-modal";

  // https://developer.algorand.org/docs/get-details/walletconnect/
  // https://docs.walletconnect.com/quick-start/dapps/web3-provider
  
  // import algosdk from "algosdk";
  // import { formatJsonRpcRequest } from "@json-rpc-tools/utils";

  export default {
    
    mounted() {
      // Create a connector
      this.connector = new WalletConnect({
        bridge: "https://bridge.walletconnect.org", // Required
        qrcodeModal: QRCodeModal,
      });

      // Check if connection is already established
      if (!this.connector.connected) {
        // create new session
        this.connector.createSession();
      }
    },
    data() {
      return {
        connector: null
      }
    },
    methods: {
    }
  }


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