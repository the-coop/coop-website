const filteredRoles = ['SOCIAL', 'MEMBER', 'LOGS', 'GAMING', 'PROJECTS', 'CONQUEST', 'SUBSCRIBER', 'GUIDE', 'KEY_INFO'];

export default class MembersUIHelper {
    static decorate(role) {
        if (role === 'COMMANDER') return '👑 ' + role;
        if (role === 'LEADER') return '🗡️ ' + role;
        if (role === 'MOTW') return '🏅 ' + 'MOTW';
        if (role === 'PROSPECT') return '🐣 ' + role;
        if (role === 'MOSTPOINTS') return '🚀 ' + role;
        if (role === 'RICHEST') return '💰 ' + role;
        
        return role;
    }
    static filter(roles) {
        return roles.filter(role => !filteredRoles.includes(role));
    }
}