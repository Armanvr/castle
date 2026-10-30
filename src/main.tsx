import { render } from 'preact'
import './index.css'
import { App } from './app.tsx'

// biome-ignore lint/style/noNonNullAssertion: we know the element is there
render(<App />, document.getElementById('app')!)
