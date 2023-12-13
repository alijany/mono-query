import axios from "axios";
import { onSet } from "nanostores";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExtractRouteParams, FetchLoadingState, FetchState, CreateQueryHookOptions, UseQueryParams, UseQueryReturn } from "./model";
import { replaceUrlParam } from "./utils";

const initialState = {
    data: null,
    fetched: false,
    error: null,
    isLoading: false,
    isError: false,
    isSuccess: false,
} as const;

export function createQueryHook<
    Req = unknown,
    U extends string = string,
>(
    url: U,
    { skip, watchAtoms, ...defaultOptions }: CreateQueryHookOptions<Req>,
) {
    return function useQuery<Res>({
        pathParams,
        validator,
        ...options
    }: UseQueryParams<Req, Res, ExtractRouteParams<U>>) {
        const [state, setState] = useState<FetchState<Res>>(initialState);
        const controller = useRef(new AbortController());

        const refresh = useCallback(async () => {
            if (skip) {
                setState((state) => ({
                    ...state,
                    isLoading: false,
                    isFetching: false,
                }));
                return;
            }

            setState(
                (state) =>
                    ({
                        ...state,
                        isError: false,
                        error: null,
                        isLoading: true,
                    }) as FetchLoadingState<Res>,
            );

            controller.current = new AbortController();

            try {
                const compiledUrl = replaceUrlParam(url, pathParams ?? {});
                const result = await axios<Res>({
                    signal: controller.current.signal,
                    ...defaultOptions,
                    ...options,
                    url: compiledUrl,
                });
                const validatorResult = validator
                    ? validator.parse(result.data)
                    : result.data;
                setState({
                    error: null,
                    data: validatorResult,
                    fetched: true,
                    isSuccess: true,
                    isLoading: false,
                    isError: false,
                });
            } catch (error: any) {
                console.warn({ error })
                setState(() => ({
                    error: error,
                    data: null,
                    fetched: false,
                    isError: true,
                    isSuccess: false,
                    isLoading: false,
                }));
            }
        }, [options, pathParams, validator]);

        useEffect(() => {
            refresh();
            return () => controller.current.abort();
        }, [refresh]);

        useEffect(() => {
            const unsubscribeCallbacks = watchAtoms?.map((refreshAtom) =>
                onSet(refreshAtom, ({ abort }) => {
                    refresh();
                    abort();
                }),
            );
            return () => {
                unsubscribeCallbacks?.map((unsubscribe) => unsubscribe());
            };
        }, [refresh]);

        return useMemo(
            () => ({
                refresh,
                ...state,
            }),
            [refresh, state],
        ) as UseQueryReturn<Res>;
    };
}
