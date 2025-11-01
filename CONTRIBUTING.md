# Contributing to Smart Cooking Sync

First off, thank you for considering contributing to Smart Cooking Sync! It's people like you that make this project better for everyone.

## 🌟 How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When you create a bug report, include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples** (screenshots, code samples, etc.)
- **Describe the behavior you observed and what you expected**
- **Include details about your environment** (OS, browser, Docker version, etc.)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

- **Use a clear and descriptive title**
- **Provide a detailed description of the proposed feature**
- **Explain why this enhancement would be useful**
- **List any similar features in other applications** if applicable

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Follow the code style** of the project
3. **Write clear, commented code** when necessary
4. **Test your changes** thoroughly
5. **Update documentation** as needed
6. **Write a good commit message**

## 💻 Development Setup

### Prerequisites
- Node.js 18+
- Python 3.11+
- MongoDB (local or Docker)
- Yarn package manager

### Setting Up Your Development Environment

1. **Fork and clone the repository**
```bash
git clone https://github.com/YOUR_USERNAME/smart-cooking-sync.git
cd smart-cooking-sync
```

2. **Install frontend dependencies**
```bash
cd frontend
yarn install
```

3. **Install backend dependencies**
```bash
cd ../backend
pip install -r requirements.txt
```

4. **Set up environment variables**
```bash
# Backend
cp backend/.env.example backend/.env

# Frontend
cp frontend/.env.example frontend/.env
```

5. **Start MongoDB** (if not using Docker)
```bash
mongod --dbpath /path/to/data
```

6. **Run the development servers**
```bash
# Terminal 1 - Backend
cd backend
uvicorn server:app --reload --host 0.0.0.0 --port 8001

# Terminal 2 - Frontend
cd frontend
yarn start
```

## 📝 Code Style Guidelines

### JavaScript/React
- Use functional components with hooks
- Follow the existing component structure
- Use meaningful variable and function names
- Add comments for complex logic
- Use British English spelling in UI text ("optimise" not "optimize")

### Python/FastAPI
- Follow PEP 8 style guide
- Use type hints
- Write descriptive docstrings for functions
- Use async/await for database operations
- Handle errors gracefully with proper HTTP status codes

### Git Commit Messages
- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests liberally after the first line

Example:
```
Add timer pause functionality

- Implement pause/resume for cooking timers
- Update UI to show pause state
- Add tests for timer state management

Fixes #123
```

## 🧪 Testing

### Frontend Tests
```bash
cd frontend
yarn test
```

### Backend Tests
```bash
cd backend
pytest
```

### Manual Testing Checklist
- [ ] Add multiple dishes with different oven types
- [ ] Verify cooking plan calculation is accurate
- [ ] Test timer start/pause/resume/reset
- [ ] Check data persists after page refresh
- [ ] Test on mobile viewport
- [ ] Verify dark mode toggle
- [ ] Test alarm functionality
- [ ] Check API endpoints return correct data

## 📚 Documentation

- Update README.md if you change functionality
- Update API documentation for new endpoints
- Add comments to complex code sections
- Update DEPLOYMENT_GUIDE.md for deployment changes

## 🔍 Code Review Process

1. All submissions require review before merging
2. Reviewers will check:
   - Code quality and style
   - Test coverage
   - Documentation updates
   - Breaking changes
3. Address reviewer feedback promptly
4. Once approved, a maintainer will merge your PR

## 🎯 Areas for Contribution

### Good First Issues
Look for issues tagged with `good first issue` - these are perfect for newcomers!

### High Priority Areas
- Performance optimisation
- Mobile responsiveness improvements
- Additional oven type support
- Recipe import functionality
- Accessibility improvements (ARIA labels, keyboard navigation)

### Documentation
- Improve existing documentation
- Add code examples
- Create video tutorials
- Translate documentation

## 💬 Community

- Be respectful and inclusive
- Welcome newcomers and encourage participation
- Assume good faith in discussions
- Give constructive feedback

## ❓ Questions?

Feel free to:
- Open an issue with your question
- Start a discussion in GitHub Discussions
- Reach out to maintainers

## 📜 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Smart Cooking Sync! 🎉👨‍🍳👩‍🍳
