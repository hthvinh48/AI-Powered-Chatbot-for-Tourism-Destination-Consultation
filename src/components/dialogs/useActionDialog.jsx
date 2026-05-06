import { useCallback, useMemo, useState } from 'react'
import ActionDialog from './ActionDialog'

export const useActionDialog = () => {
  const [dialog, setDialog] = useState(null)

  const askConfirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      setDialog({
        mode: 'confirm',
        options,
        resolve,
      })
    })
  }, [])

  const askPrompt = useCallback((options = {}) => {
    return new Promise((resolve) => {
      setDialog({
        mode: 'prompt',
        options,
        resolve,
      })
    })
  }, [])

  const closeDialog = useCallback((result) => {
    setDialog((current) => {
      if (current?.resolve) current.resolve(result)
      return null
    })
  }, [])

  const dialogNode = useMemo(() => {
    if (!dialog) return null

    const { mode, options } = dialog
    return (
      <ActionDialog
        mode={mode}
        tone={options.tone}
        title={options.title}
        message={options.message}
        confirmText={options.confirmText}
        cancelText={options.cancelText}
        confirmVariant={options.confirmVariant}
        promptLabel={options.promptLabel}
        promptPlaceholder={options.promptPlaceholder}
        initialValue={options.initialValue}
        requireInput={Boolean(options.requireInput)}
        onCancel={() => closeDialog(mode === 'confirm' ? false : null)}
        onConfirm={(value) => closeDialog(mode === 'confirm' ? true : value)}
      />
    )
  }, [dialog, closeDialog])

  return {
    askConfirm,
    askPrompt,
    dialogNode,
  }
}

export default useActionDialog
