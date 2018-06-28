export default {
    template: `
    <div style="margin: 1em; padding:1em;">
     <h3>Dynamic Component</h3>
     <p>{{ message }}</p>
    </div>
  `,
    data() {
        return {
            message: 'Oh hai from the component.',
        }
    }
}