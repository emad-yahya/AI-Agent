import { useCallback, useState } from "react";

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useAsync<T>() {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const run = useCallback(async (promise: Promise<T>) => {
    setState({ data: null, loading: true, error: null });
    try {
      const data = await promise;
      setState({ data, loading: false, error: null });
      return data;
    } catch (error: any) {
      const message =
        error?.response?.data?.message ??
        error?.message ??
        "Something went wrong";
      setState({ data: null, loading: false, error: message });
      return null;
    }
  }, []);

  return { ...state, run };
}
