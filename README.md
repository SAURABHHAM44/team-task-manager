# TaskFlow — Team Task Manager

A full-stack web application to manage team projects and tasks with role-based access control (Admin/Member).

## Live Demo
https://team-task-manager-production-7f6b.up.railway.app

## GitHub Repository
https://github.com/SAURABHHAM44/team-task-manager

## Features
- User authentication (Signup/Login) with JWT tokens
- Role-based access control (Admin/Member)
- Create and manage multiple projects
- Add team members to projects
- Create, assign and track tasks
- Task status tracking (Todo, In Progress, Review, Done)
- Priority levels (High, Medium, Low)
- Overdue task detection and alerts
- Dashboard with task statistics

## Tech Stack
- Frontend: HTML, CSS, Vanilla JavaScript
- Backend: Node.js + Express.js
- Database: SQLite (better-sqlite3)
- Authentication: JWT + bcryptjs
- Deployment: Railway

## Installation & Setup

1. Clone the repository
   git clone https://github.com/SAURABHHAM44/team-task-manager.git

2. Navigate to project folder
   cd team-task-manager

3. Install dependencies
   npm install

4. Create a .env file in root folder and add:
   JWT_SECRET=mysuper$ecretkey2024xZ
   PORT=3000

5. Start the server
   npm start

6. Open browser and go to
   http://localhost:3000

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/signup | Register new user |
| POST | /api/auth/login | Login user |
| GET | /api/auth/me | Get current user |
| GET | /api/auth/users | Get all users |

### Projects
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/projects | Get all projects |
| POST | /api/projects | Create project |
| GET | /api/projects/:id | Get single project |
| POST | /api/projects/:id/members | Add member |
| DELETE | /api/projects/:id | Delete project |

### Tasks
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/tasks | Create task |
| GET | /api/tasks/dashboard | Get my tasks and stats |
| GET | /api/tasks/project/:id | Get project tasks |
| PATCH | /api/tasks/:id/status | Update task status |
| PUT | /api/tasks/:id | Update full task |
| DELETE | /api/tasks/:id | Delete task |

## Role Based Access Control

### Admin
- Create and delete projects
- Add team members to projects
- Create, assign and delete any task
- View all project data

### Member
- View projects they are part of
- Create tasks in their projects
- Update task status
- View their assigned tasks on dashboard

## Database Schema
- users: id, name, email, password, role, created_at
- projects: id, name, description, owner_id, created_at
- project_members: project_id, user_id, role
- tasks: id, title, description, status, priority, project_id, assigned_to, created_by, due_date, created_at