"use client";

import { useActionState, useEffect, useRef, useTransition, type FormEvent } from "react";

/**
 * Server Action für ein Formular, OHNE dass React die Eingaben nach dem Absenden
 * zurücksetzt (Standard bei `<form action>` in React 19). So bleiben Eingaben bei
 * Fehlermeldungen erhalten. Mit `resetOnSuccess` wird das Formular nur nach Erfolg
 * geleert (z. B. „Neu anlegen“-Formulare).
 */
export function useFormAction<State extends { status: string }>(
  action: (state: Awaited<State>, formData: FormData) => State | Promise<State>,
  initialState: Awaited<State>,
  { resetOnSuccess = false }: { resetOnSuccess?: boolean } = {},
) {
  const [state, dispatch, isPending] = useActionState(action, initialState);
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state.status === "success") formRef.current?.reset();
  }, [state, resetOnSuccess]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter instanceof HTMLButtonElement ? submitter : null);
    startTransition(() => dispatch(formData));
  };

  return { state, isPending, formRef, onSubmit };
}
