try {
  process.loadEnvFile()
} catch {
  console.warn('.env file is not found, using process environment')
}
