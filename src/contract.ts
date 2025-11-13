import { createPublicClient, http, decodeAbiParameters, encodeFunctionData } from 'viem';

const RPC_URL = process.env.RPC_URL || 'https://rpc.gnosischain.com';
const REFERRAL_CONTRACT_ADDRESS = process.env.REFERRAL_CONTRACT_ADDRESS as `0x${string}`;

if (!REFERRAL_CONTRACT_ADDRESS) {
  throw new Error('REFERRAL_CONTRACT_ADDRESS environment variable is not set');
}

const client = createPublicClient({
  transport: http(RPC_URL),
});

// ABI for the accounts function: accounts(address signer) returns (address account, bool claimed)
const ACCOUNTS_ABI = [
  {
    name: 'accounts',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      {
        name: 'signer',
        type: 'address',
      },
    ],
    outputs: [
      {
        name: 'account',
        type: 'address',
      },
      {
        name: 'claimed',
        type: 'bool',
      },
    ],
  },
] as const;

/**
 * Check if an invite is used by calling the ReferralContract.accounts function
 * @param signer The signer address to check
 * @returns Object with account address and claimed status
 */
export async function checkInviteOnChain(signer: string): Promise<{ account: string; claimed: boolean }> {
  try {
    // Ensure signer is a valid address format
    const signerAddress = (signer.toLowerCase().startsWith('0x') ? signer : `0x${signer}`) as `0x${string}`;

    // Encode the function call using ABI encoding
    const encodedData = encodeFunctionData({
      abi: ACCOUNTS_ABI,
      functionName: 'accounts',
      args: [signerAddress],
    });

    // Make the eth_call
    const result = await client.call({
      account: '0x0000000000000000000000000000000000000000',
      to: REFERRAL_CONTRACT_ADDRESS,
      data: encodedData,
    });

    if (!result.data) {
      // If no data is returned, treat as not claimed (address doesn't exist in contract)
      return {
        account: '0x0000000000000000000000000000000000000000',
        claimed: false,
      };
    }

    // Decode the result: (address account, bool claimed)
    // address is 32 bytes, bool is 32 bytes
    const decodedData = decodeAbiParameters(
      [
        { type: 'address' },
        { type: 'bool' },
      ],
      result.data
    );

    const account = decodedData[0];
    const claimed = decodedData[1];

    // If account is the zero address, the signer doesn't exist in the contract
    // Return zero address and claimed status
    return {
      account,
      claimed,
    };
  } catch (error) {
    console.error('Error checking invite on chain:', error);
    // If the call reverts, treat it as "not claimed" since the address likely doesn't exist on the contract
    // This is the expected behavior when an address hasn't been used yet
    return {
      account: '0x0000000000000000000000000000000000000000',
      claimed: false,
    };
  }
}
