import { nanoid } from '@reduxjs/toolkit'
import { ChainId } from '@uniswap/sdk'
import { TokenList } from '@uniswap/token-lists'
import { useCallback } from 'react'
import { useDispatch } from 'react-redux'
import { getNetworkLibrary, NETWORK_CHAIN_ID } from '../connectors'
import { AppDispatch } from '../state'
import { fetchTokenList } from '../state/lists/actions'
import getTokenList from '../utils/getTokenList'
import resolveENSContentHash from '../utils/resolveENSContentHash'
import { useActiveWeb3React } from './index'

export function useFetchListCallback(): (listUrl: string, sendDispatch?: boolean) => Promise<TokenList> {
  const { chainId, library } = useActiveWeb3React()
  const dispatch = useDispatch<AppDispatch>()

  const ensResolver = useCallback(
    (ensName: string) => {
      if (!library || chainId !== ChainId.MAINNET) {
        if (NETWORK_CHAIN_ID === ChainId.MAINNET) {
          const networkLibrary = getNetworkLibrary()
          if (networkLibrary) {
            return resolveENSContentHash(ensName, networkLibrary)
          }
        }
        throw new Error('Could not construct mainnet ENS resolver')
      }
      return resolveENSContentHash(ensName, library)
    },
    [chainId, library]
  )

  // note: prevent dispatch if using for list search or unsupported list
  return useCallback(
    async (listUrl: string, sendDispatch = true) => {
      const requestId = nanoid()
      sendDispatch && dispatch(fetchTokenList.pending({ requestId, url: listUrl }))

      return getTokenList(listUrl, ensResolver)
        .then(tokenList => {
          sendDispatch && dispatch(fetchTokenList.fulfilled({ url: listUrl, tokenList, requestId }))
          return tokenList
        })
        .catch(error => {
          console.debug(`Failed to get list at url ${listUrl}`, error)
          sendDispatch && dispatch(fetchTokenList.rejected({ url: listUrl, requestId, errorMessage: error.message }))
          throw error
        })
    },
    [dispatch, ensResolver]
  )
}

export function useFetch0xListCallback(): (listUrl: string, sendDispatch?: boolean) => Promise<TokenList> {
  const { chainId } = useActiveWeb3React()
  const dispatch = useDispatch<AppDispatch>()

  // note: prevent dispatch if using for list search or unsupported list
  return useCallback(
    async (listUrl: string, sendDispatch = true) => {
      const requestId = nanoid()
      sendDispatch && dispatch(fetchTokenList.pending({ requestId, url: listUrl }))

      const res = await fetch('https://api.0x.org/swap/v1/tokens')
      const { records } = await res.json()
      const tokens = records.map((token: any) => {
        return {
          ...token,
          chainId,
          logoURI: "https://assets.coingecko.com/coins/images/12645/thumb/AAVE.png?1601374110"
        }
      })
      const tokenList = {
        name: '0x Tokens',
        version: {
          major: 1,
          minor: 0,
          patch: 0
        },
        timestamp: '2021-02-12T01:33:04+00:00',
        tokens
      }
      dispatch(fetchTokenList.fulfilled({ url: listUrl, tokenList, requestId }))

      return tokenList
      // return getTokenList()
      //   .then(tokenList => {
      //     sendDispatch && dispatch(fetchTokenList.fulfilled({ url: listUrl, tokenList, requestId }))
      //     return tokenList
      //   })
      //   .catch(error => {
      //     console.debug(`Failed to get list at url ${listUrl}`, error)
      //     sendDispatch && dispatch(fetchTokenList.rejected({ url: listUrl, requestId, errorMessage: error.message }))
      //     throw error
      //   })
    },
    [dispatch, chainId]
  )
}
